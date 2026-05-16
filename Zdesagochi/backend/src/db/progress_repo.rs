use crate::{
    domain::progress::{Achievement, AchievementDef, DailyQuest, QuestDef},
    engine::catalog,
    error::AppError,
};
use chrono::Utc;
use sqlx::{PgPool, Postgres, Transaction};

type Tx<'a> = Transaction<'a, Postgres>;

// ─── Achievements ─────────────────────────────────────────────────────────────

pub async fn ensure_achievements_seeded(pool: &PgPool, user_id: &str) -> Result<(), AppError> {
    let defs = catalog::achievement_defs();
    let ids: Vec<String> = defs.iter().map(|d| d.id.clone()).collect();
    sqlx::query(
        "INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked, claimed)
         SELECT $1, unnest($2::text[]), 0, false, false
         ON CONFLICT (user_id, achievement_id) DO NOTHING",
    )
    .bind(user_id)
    .bind(&ids)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_achievements(pool: &PgPool, user_id: &str) -> Result<Vec<Achievement>, AppError> {
    ensure_achievements_seeded(pool, user_id).await?;
    let defs: Vec<AchievementDef> = catalog::achievement_defs();

    #[derive(sqlx::FromRow)]
    struct Row {
        achievement_id: String,
        progress: i32,
        unlocked: bool,
        unlocked_at: Option<chrono::DateTime<Utc>>,
        claimed: bool,
    }

    let rows = sqlx::query_as::<_, Row>(
        "SELECT achievement_id, progress, unlocked, unlocked_at, claimed
         FROM user_achievements WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let mut out = Vec::new();
    for def in defs {
        let row = rows.iter().find(|r| r.achievement_id == def.id);
        let (progress, unlocked, unlocked_at, claimed) = row
            .map(|r| {
                (
                    r.progress,
                    r.unlocked,
                    r.unlocked_at.map(|t| t.to_rfc3339()),
                    r.claimed,
                )
            })
            .unwrap_or((0, false, None, false));
        out.push(Achievement {
            id: def.id,
            name: def.name,
            description: def.description,
            emoji: def.emoji,
            category: def.category,
            progress,
            target: def.target,
            unlocked,
            unlocked_at,
            claimed,
            reward: def.reward,
        });
    }
    Ok(out)
}

pub async fn tick_achievement(
    pool: &PgPool,
    user_id: &str,
    achievement_id: &str,
    increment: i32,
) -> Result<(), AppError> {
    let defs = catalog::achievement_defs();
    let target = defs
        .iter()
        .find(|d| d.id == achievement_id)
        .map(|d| d.target)
        .unwrap_or(1);
    sqlx::query(
        "INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked, claimed)
         VALUES ($1, $2, $3, $3 >= $4, false)
         ON CONFLICT (user_id, achievement_id) DO UPDATE SET
           progress = LEAST(user_achievements.progress + $3, $4),
           unlocked = LEAST(user_achievements.progress + $3, $4) >= $4,
           unlocked_at = CASE
             WHEN NOT user_achievements.unlocked AND LEAST(user_achievements.progress + $3, $4) >= $4
             THEN NOW() ELSE user_achievements.unlocked_at END"
    )
    .bind(user_id)
    .bind(achievement_id)
    .bind(increment)
    .bind(target)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn tick_achievement_tx(
    tx: &mut Tx<'_>,
    user_id: &str,
    achievement_id: &str,
    increment: i32,
) -> Result<(), AppError> {
    let defs = catalog::achievement_defs();
    let target = defs
        .iter()
        .find(|d| d.id == achievement_id)
        .map(|d| d.target)
        .unwrap_or(1);
    sqlx::query(
        "INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked, claimed)
         VALUES ($1, $2, $3, $3 >= $4, false)
         ON CONFLICT (user_id, achievement_id) DO UPDATE SET
           progress = LEAST(user_achievements.progress + $3, $4),
           unlocked = LEAST(user_achievements.progress + $3, $4) >= $4,
           unlocked_at = CASE
             WHEN NOT user_achievements.unlocked AND LEAST(user_achievements.progress + $3, $4) >= $4
             THEN NOW() ELSE user_achievements.unlocked_at END"
    )
    .bind(user_id)
    .bind(achievement_id)
    .bind(increment)
    .bind(target)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn mark_achievement_claimed_tx(
    tx: &mut Tx<'_>,
    user_id: &str,
    achievement_id: &str,
) -> Result<Achievement, AppError> {
    let defs = catalog::achievement_defs();
    let def = defs
        .into_iter()
        .find(|d| d.id == achievement_id)
        .ok_or_else(|| AppError::NotFound(format!("Achievement {} not found", achievement_id)))?;

    #[derive(sqlx::FromRow)]
    struct Row {
        progress: i32,
        unlocked: bool,
        unlocked_at: Option<chrono::DateTime<Utc>>,
    }

    let row = sqlx::query_as::<_, Row>(
        "UPDATE user_achievements SET claimed = true
         WHERE user_id = $1 AND achievement_id = $2 AND unlocked = true AND claimed = false
         RETURNING progress, unlocked, unlocked_at",
    )
    .bind(user_id)
    .bind(achievement_id)
    .fetch_optional(&mut **tx)
    .await?;

    let row = row.ok_or_else(|| {
        AppError::BadRequest("Achievement not unlocked or already claimed".into())
    })?;

    Ok(Achievement {
        id: def.id,
        name: def.name,
        description: def.description,
        emoji: def.emoji,
        category: def.category,
        progress: row.progress,
        target: def.target,
        unlocked: row.unlocked,
        unlocked_at: row.unlocked_at.map(|t| t.to_rfc3339()),
        claimed: true,
        reward: def.reward,
    })
}

#[allow(dead_code)]
pub async fn claim_achievement(
    pool: &PgPool,
    user_id: &str,
    achievement_id: &str,
) -> Result<Achievement, AppError> {
    let mut tx = pool.begin().await?;
    let achievement = mark_achievement_claimed_tx(&mut tx, user_id, achievement_id).await?;
    tx.commit().await?;
    Ok(achievement)
}

// ─── Quests ───────────────────────────────────────────────────────────────────

fn end_of_day_utc() -> String {
    use chrono::{Datelike, TimeZone};
    let now = Utc::now();
    let eod = Utc
        .with_ymd_and_hms(now.year(), now.month(), now.day(), 23, 59, 59)
        .single()
        .unwrap_or(now);
    eod.to_rfc3339()
}

pub async fn ensure_quests_seeded(pool: &PgPool, user_id: &str) -> Result<(), AppError> {
    let defs = catalog::quest_defs();
    let expires = end_of_day_utc();
    let ids: Vec<String> = defs.iter().map(|d| d.id.clone()).collect();
    sqlx::query(
        "INSERT INTO user_quests (user_id, quest_id, progress, completed, claimed, expires_at)
         SELECT $1, unnest($2::text[]), 0, false, false, $3::timestamptz
         ON CONFLICT (user_id, quest_id, expires_at) DO NOTHING",
    )
    .bind(user_id)
    .bind(&ids)
    .bind(&expires)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_quests(pool: &PgPool, user_id: &str) -> Result<Vec<DailyQuest>, AppError> {
    ensure_quests_seeded(pool, user_id).await?;
    let defs: Vec<QuestDef> = catalog::quest_defs();
    let expires = end_of_day_utc();

    #[derive(sqlx::FromRow)]
    struct Row {
        quest_id: String,
        progress: i32,
        completed: bool,
        claimed: bool,
    }

    let rows = sqlx::query_as::<_, Row>(
        "SELECT quest_id, progress, completed, claimed FROM user_quests
         WHERE user_id = $1 AND expires_at >= NOW()",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let mut out = Vec::new();
    for def in defs {
        let row = rows.iter().find(|r| r.quest_id == def.id);
        let (progress, completed, claimed) = row
            .map(|r| (r.progress, r.completed, r.claimed))
            .unwrap_or((0, false, false));
        out.push(DailyQuest {
            id: def.id,
            name: def.name,
            description: def.description,
            emoji: def.emoji,
            progress,
            target: def.target,
            completed,
            claimed,
            reward: def.reward,
            expires_at: expires.clone(),
        });
    }
    Ok(out)
}

pub async fn tick_quest_tx(tx: &mut Tx<'_>, user_id: &str, quest_id: &str) -> Result<(), AppError> {
    let defs = catalog::quest_defs();
    let target = defs
        .iter()
        .find(|d| d.id == quest_id)
        .map(|d| d.target)
        .unwrap_or(1);
    sqlx::query(
        "UPDATE user_quests SET
           progress = LEAST(progress + 1, $3),
           completed = LEAST(progress + 1, $3) >= $3
         WHERE user_id = $1 AND quest_id = $2 AND expires_at >= NOW()",
    )
    .bind(user_id)
    .bind(quest_id)
    .bind(target)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn tick_quest(pool: &PgPool, user_id: &str, quest_id: &str) -> Result<(), AppError> {
    let defs = catalog::quest_defs();
    let target = defs
        .iter()
        .find(|d| d.id == quest_id)
        .map(|d| d.target)
        .unwrap_or(1);
    sqlx::query(
        "UPDATE user_quests SET
           progress = LEAST(progress + 1, $3),
           completed = LEAST(progress + 1, $3) >= $3
         WHERE user_id = $1 AND quest_id = $2 AND expires_at >= NOW()",
    )
    .bind(user_id)
    .bind(quest_id)
    .bind(target)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn mark_quest_claimed_tx(
    tx: &mut Tx<'_>,
    user_id: &str,
    quest_id: &str,
) -> Result<DailyQuest, AppError> {
    let defs = catalog::quest_defs();
    let def = defs
        .into_iter()
        .find(|d| d.id == quest_id)
        .ok_or_else(|| AppError::NotFound(format!("Quest {} not found", quest_id)))?;

    #[derive(sqlx::FromRow)]
    struct Row {
        progress: i32,
        completed: bool,
        expires_at: chrono::DateTime<Utc>,
    }

    let row = sqlx::query_as::<_, Row>(
        "UPDATE user_quests SET claimed = true
         WHERE user_id = $1 AND quest_id = $2 AND completed = true AND claimed = false AND expires_at >= NOW()
         RETURNING progress, completed, expires_at"
    )
    .bind(user_id)
    .bind(quest_id)
    .fetch_optional(&mut **tx)
    .await?;

    let row =
        row.ok_or_else(|| AppError::BadRequest("Quest not completed or already claimed".into()))?;

    Ok(DailyQuest {
        id: def.id,
        name: def.name,
        description: def.description,
        emoji: def.emoji,
        progress: row.progress,
        target: def.target,
        completed: row.completed,
        claimed: true,
        reward: def.reward,
        expires_at: row.expires_at.to_rfc3339(),
    })
}

#[allow(dead_code)]
pub async fn claim_quest(
    pool: &PgPool,
    user_id: &str,
    quest_id: &str,
) -> Result<DailyQuest, AppError> {
    let mut tx = pool.begin().await?;
    let q = mark_quest_claimed_tx(&mut tx, user_id, quest_id).await?;
    tx.commit().await?;
    Ok(q)
}

pub async fn reset_daily_quests(pool: &PgPool) -> Result<u64, AppError> {
    let result = sqlx::query("DELETE FROM user_quests WHERE expires_at < NOW()")
        .execute(pool)
        .await?;
    Ok(result.rows_affected())
}
