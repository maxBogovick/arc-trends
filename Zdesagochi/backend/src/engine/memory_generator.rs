// ════════════════════════════════════════════════════════════════════════════
//  MEMORY GENERATOR — Simple memory text templates
// ════════════════════════════════════════════════════════════════════════════

pub fn generate_memory_text(trait_key: &str, direction: &str, _personality_id: &str) -> String {
    match direction {
        "origin" => "Что-то важное началось".to_string(),
        "up" => match trait_key {
            "vitality" => "Сила прибавилась".to_string(),
            "sociality" => "Стал ближе к тебе".to_string(),
            "order" => "Порядок восстановлен".to_string(),
            "appetite" => "Аппетит разгорелся".to_string(),
            "caution" => "Осторожность выросла".to_string(),
            "curiosity" => "Любопытство пробудилось".to_string(),
            _ => "Что-то изменилось к лучшему".to_string(),
        },
        "down" => match trait_key {
            "vitality" => "Сила немного упала".to_string(),
            "sociality" => "Стал чуть более замкнутым".to_string(),
            "order" => "Порядка стало меньше".to_string(),
            "appetite" => "Аппетит снизился".to_string(),
            "caution" => "Осторожность уменьшилась".to_string(),
            "curiosity" => "Интерес угас".to_string(),
            _ => "Что-то изменилось".to_string(),
        },
        _ => "Что-то изменилось".to_string(),
    }
}
