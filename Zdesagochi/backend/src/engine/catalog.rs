// ════════════════════════════════════════════════════════════════════════════
//  CATALOG — static game data (foods, shop, rooms, achievements, quests)
//  Mirrors data from src/api/mockApi.ts
// ════════════════════════════════════════════════════════════════════════════

use std::collections::HashMap;
use std::sync::OnceLock;

use crate::domain::{
    economy::{FoodItem, ItemEffect, ItemRarity, ItemType, ShopItem},
    progress::{AchievementCategory, AchievementDef, QuestDef, QuestReward},
    rooms::RoomDecoration,
};

// ─── Cached lookups (OnceLock) ─────────────────────────────────────────────────

static SHOP_ITEMS_MAP: OnceLock<HashMap<String, ShopItem>> = OnceLock::new();
static FOODS_MAP: OnceLock<HashMap<String, FoodItem>> = OnceLock::new();

fn shop_items_map() -> &'static HashMap<String, ShopItem> {
    SHOP_ITEMS_MAP.get_or_init(|| {
        shop_items()
            .into_iter()
            .map(|i| (i.id.clone(), i))
            .collect()
    })
}

fn foods_map() -> &'static HashMap<String, FoodItem> {
    FOODS_MAP.get_or_init(|| foods().into_iter().map(|f| (f.id.clone(), f)).collect())
}

// ─── Foods ───────────────────────────────────────────────────────────────────

pub fn foods() -> Vec<FoodItem> {
    vec![
        FoodItem {
            id: "apple".into(),
            name: "Яблоко".into(),
            emoji: "🍎".into(),
            hunger_restore: 20,
            happiness_bonus: 5,
            health_bonus: 10,
            description: "Витаминное и полезное".into(),
        },
        FoodItem {
            id: "pizza".into(),
            name: "Пицца".into(),
            emoji: "🍕".into(),
            hunger_restore: 40,
            happiness_bonus: 20,
            health_bonus: -5,
            description: "Вкусно, но немного вредно".into(),
        },
        FoodItem {
            id: "sushi".into(),
            name: "Суши".into(),
            emoji: "🍣".into(),
            hunger_restore: 30,
            happiness_bonus: 15,
            health_bonus: 5,
            description: "Экзотика и польза".into(),
        },
        FoodItem {
            id: "candy".into(),
            name: "Конфета".into(),
            emoji: "🍬".into(),
            hunger_restore: 10,
            happiness_bonus: 30,
            health_bonus: -10,
            description: "Сладко, но много нельзя!".into(),
        },
        FoodItem {
            id: "salad".into(),
            name: "Салат".into(),
            emoji: "🥗".into(),
            hunger_restore: 25,
            happiness_bonus: 5,
            health_bonus: 20,
            description: "Очень полезно".into(),
        },
        FoodItem {
            id: "ramen".into(),
            name: "Рамен".into(),
            emoji: "🍜".into(),
            hunger_restore: 45,
            happiness_bonus: 25,
            health_bonus: 0,
            description: "Сытно и вкусно".into(),
        },
        FoodItem {
            id: "milk".into(),
            name: "Молоко".into(),
            emoji: "🥛".into(),
            hunger_restore: 15,
            happiness_bonus: 8,
            health_bonus: 15,
            description: "Кальций для роста".into(),
        },
        FoodItem {
            id: "cake".into(),
            name: "Торт".into(),
            emoji: "🎂".into(),
            hunger_restore: 35,
            happiness_bonus: 35,
            health_bonus: -8,
            description: "Праздник для питомца!".into(),
        },
    ]
}

// ─── Shop ─────────────────────────────────────────────────────────────────────

pub fn shop_items() -> Vec<ShopItem> {
    vec![
        ShopItem {
            id: "premium_burger".into(),
            name: "Премиум-бургер".into(),
            emoji: "🍔".into(),
            description: "Огромная и очень сытная".into(),
            price: 25,
            item_type: ItemType::Food,
            rarity: ItemRarity::Rare,
            effect: ItemEffect {
                hunger: Some(55),
                happiness: Some(20),
                ..Default::default()
            },
        },
        ShopItem {
            id: "dragon_fruit".into(),
            name: "Питайя".into(),
            emoji: "🐉".into(),
            description: "Мистический фрукт силы".into(),
            price: 35,
            item_type: ItemType::Food,
            rarity: ItemRarity::Epic,
            effect: ItemEffect {
                hunger: Some(30),
                health: Some(35),
                xp: Some(20),
                ..Default::default()
            },
        },
        ShopItem {
            id: "magic_potion".into(),
            name: "Магическое зелье".into(),
            emoji: "🧪".into(),
            description: "Восстанавливает всё!".into(),
            price: 60,
            item_type: ItemType::Food,
            rarity: ItemRarity::Epic,
            effect: ItemEffect {
                hunger: Some(40),
                happiness: Some(40),
                health: Some(40),
                ..Default::default()
            },
        },
        ShopItem {
            id: "galaxy_cake".into(),
            name: "Галактический торт".into(),
            emoji: "🎂".into(),
            description: "Легендарная сладость".into(),
            price: 80,
            item_type: ItemType::Food,
            rarity: ItemRarity::Legendary,
            effect: ItemEffect {
                hunger: Some(50),
                happiness: Some(60),
                xp: Some(50),
                ..Default::default()
            },
        },
        ShopItem {
            id: "star_smoothie".into(),
            name: "Звёздный смузи".into(),
            emoji: "🥤".into(),
            description: "Даёт энергию на весь день".into(),
            price: 30,
            item_type: ItemType::Food,
            rarity: ItemRarity::Common,
            effect: ItemEffect {
                energy: Some(60),
                health: Some(10),
                ..Default::default()
            },
        },
        ShopItem {
            id: "rubber_ball".into(),
            name: "Резиновый мяч".into(),
            emoji: "🔴".into(),
            description: "+15 радости и +5 XP".into(),
            price: 20,
            item_type: ItemType::Toy,
            rarity: ItemRarity::Common,
            effect: ItemEffect {
                happiness: Some(15),
                xp: Some(5),
                ..Default::default()
            },
        },
        ShopItem {
            id: "frisbee".into(),
            name: "Фрисби".into(),
            emoji: "🥏".into(),
            description: "+25 радости".into(),
            price: 35,
            item_type: ItemType::Toy,
            rarity: ItemRarity::Rare,
            effect: ItemEffect {
                happiness: Some(25),
                bond: Some(10),
                ..Default::default()
            },
        },
        ShopItem {
            id: "puzzle".into(),
            name: "Головоломка".into(),
            emoji: "🧩".into(),
            description: "Умная игра за +30 XP".into(),
            price: 50,
            item_type: ItemType::Toy,
            rarity: ItemRarity::Rare,
            effect: ItemEffect {
                happiness: Some(20),
                xp: Some(30),
                ..Default::default()
            },
        },
        ShopItem {
            id: "music_box".into(),
            name: "Музыкальная шкатулка".into(),
            emoji: "🎵".into(),
            description: "Расслабляет и радует".into(),
            price: 70,
            item_type: ItemType::Toy,
            rarity: ItemRarity::Epic,
            effect: ItemEffect {
                happiness: Some(35),
                energy: Some(20),
                bond: Some(15),
                ..Default::default()
            },
        },
        ShopItem {
            id: "magic_wand".into(),
            name: "Волшебная палочка".into(),
            emoji: "🪄".into(),
            description: "Легендарная игрушка".into(),
            price: 150,
            item_type: ItemType::Toy,
            rarity: ItemRarity::Legendary,
            effect: ItemEffect {
                happiness: Some(50),
                xp: Some(80),
                bond: Some(20),
                ..Default::default()
            },
        },
        ShopItem {
            id: "vitamin".into(),
            name: "Витамин C".into(),
            emoji: "💊".into(),
            description: "+20 здоровья".into(),
            price: 15,
            item_type: ItemType::Medicine,
            rarity: ItemRarity::Common,
            effect: ItemEffect {
                health: Some(20),
                ..Default::default()
            },
        },
        ShopItem {
            id: "energy_drink".into(),
            name: "Энергетик".into(),
            emoji: "⚡".into(),
            description: "+50 энергии моментально".into(),
            price: 25,
            item_type: ItemType::Medicine,
            rarity: ItemRarity::Common,
            effect: ItemEffect {
                energy: Some(50),
                ..Default::default()
            },
        },
        ShopItem {
            id: "super_heal".into(),
            name: "Супер-лечение".into(),
            emoji: "💉".into(),
            description: "+60 здоровья".into(),
            price: 80,
            item_type: ItemType::Medicine,
            rarity: ItemRarity::Epic,
            effect: ItemEffect {
                health: Some(60),
                happiness: Some(10),
                ..Default::default()
            },
        },
        ShopItem {
            id: "elixir".into(),
            name: "Элексир жизни".into(),
            emoji: "✨".into(),
            description: "Восстанавливает всё здоровье".into(),
            price: 120,
            item_type: ItemType::Medicine,
            rarity: ItemRarity::Legendary,
            effect: ItemEffect {
                health: Some(100),
                energy: Some(50),
                ..Default::default()
            },
        },
        ShopItem {
            id: "plant".into(),
            name: "Растение".into(),
            emoji: "🌿".into(),
            description: "Украшает комнату +15 связи".into(),
            price: 30,
            item_type: ItemType::Decoration,
            rarity: ItemRarity::Common,
            effect: ItemEffect {
                bond: Some(15),
                ..Default::default()
            },
        },
        ShopItem {
            id: "fairy_lights".into(),
            name: "Гирлянда".into(),
            emoji: "✨".into(),
            description: "Создаёт уют +20 связи".into(),
            price: 45,
            item_type: ItemType::Decoration,
            rarity: ItemRarity::Rare,
            effect: ItemEffect {
                bond: Some(20),
                happiness: Some(10),
                ..Default::default()
            },
        },
        ShopItem {
            id: "crystal_ball".into(),
            name: "Хрустальный шар".into(),
            emoji: "🔮".into(),
            description: "Мистическое украшение".into(),
            price: 100,
            item_type: ItemType::Decoration,
            rarity: ItemRarity::Epic,
            effect: ItemEffect {
                bond: Some(30),
                xp: Some(40),
                ..Default::default()
            },
        },
    ]
}

pub fn find_shop_item(id: &str) -> Option<ShopItem> {
    shop_items_map().get(id).cloned()
}

#[allow(dead_code)]
pub fn find_food(id: &str) -> Option<FoodItem> {
    foods_map().get(id).cloned()
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

pub fn rooms_catalog() -> Vec<crate::domain::rooms::RoomDef> {
    use crate::domain::rooms::RoomDef;
    vec![
        RoomDef {
            id: "default".into(),
            name: "Уютная комната".into(),
            emoji: "🏠".into(),
            description: "Стандартная комната".into(),
            price: 0,
            gradient: "linear-gradient(180deg, #E0E7FF 0%, #F0FDFB 60%, #D1FAE5 100%)".into(),
            floor_gradient: "linear-gradient(180deg, transparent, rgba(167,139,250,0.1))".into(),
            decorations: vec![
                RoomDecoration {
                    emoji: "🪴".into(),
                    x: 8.0,
                    y: 70.0,
                    size: 28.0,
                },
                RoomDecoration {
                    emoji: "⭐".into(),
                    x: 85.0,
                    y: 12.0,
                    size: 18.0,
                },
            ],
        },
        RoomDef {
            id: "forest".into(),
            name: "Лесная поляна".into(),
            emoji: "🌲".into(),
            description: "Живая природа вокруг".into(),
            price: 150,
            gradient: "linear-gradient(180deg, #BBF7D0 0%, #D1FAE5 50%, #86EFAC 100%)".into(),
            floor_gradient: "linear-gradient(180deg, transparent, rgba(34,197,94,0.15))".into(),
            decorations: vec![
                RoomDecoration {
                    emoji: "🌳".into(),
                    x: 5.0,
                    y: 55.0,
                    size: 40.0,
                },
                RoomDecoration {
                    emoji: "🌲".into(),
                    x: 78.0,
                    y: 60.0,
                    size: 35.0,
                },
                RoomDecoration {
                    emoji: "🦋".into(),
                    x: 72.0,
                    y: 20.0,
                    size: 22.0,
                },
                RoomDecoration {
                    emoji: "🌸".into(),
                    x: 50.0,
                    y: 72.0,
                    size: 20.0,
                },
            ],
        },
        RoomDef {
            id: "space".into(),
            name: "Открытый космос".into(),
            emoji: "🚀".into(),
            description: "Среди звёзд и галактик".into(),
            price: 200,
            gradient: "linear-gradient(180deg, #1E1B4B 0%, #312E81 50%, #2E1065 100%)".into(),
            floor_gradient: "linear-gradient(180deg, transparent, rgba(99,102,241,0.2))".into(),
            decorations: vec![
                RoomDecoration {
                    emoji: "🌙".into(),
                    x: 15.0,
                    y: 10.0,
                    size: 28.0,
                },
                RoomDecoration {
                    emoji: "🪐".into(),
                    x: 75.0,
                    y: 15.0,
                    size: 30.0,
                },
                RoomDecoration {
                    emoji: "⭐".into(),
                    x: 40.0,
                    y: 8.0,
                    size: 16.0,
                },
                RoomDecoration {
                    emoji: "🛸".into(),
                    x: 60.0,
                    y: 5.0,
                    size: 24.0,
                },
            ],
        },
        RoomDef {
            id: "beach".into(),
            name: "Тропический пляж".into(),
            emoji: "🏖".into(),
            description: "Солнце, море, волны".into(),
            price: 175,
            gradient: "linear-gradient(180deg, #BAE6FD 0%, #FEF3C7 55%, #FDE68A 100%)".into(),
            floor_gradient: "linear-gradient(180deg, transparent, rgba(234,179,8,0.2))".into(),
            decorations: vec![
                RoomDecoration {
                    emoji: "🌴".into(),
                    x: 5.0,
                    y: 55.0,
                    size: 38.0,
                },
                RoomDecoration {
                    emoji: "🌊".into(),
                    x: 78.0,
                    y: 68.0,
                    size: 28.0,
                },
                RoomDecoration {
                    emoji: "☀️".into(),
                    x: 80.0,
                    y: 8.0,
                    size: 30.0,
                },
                RoomDecoration {
                    emoji: "🐚".into(),
                    x: 50.0,
                    y: 76.0,
                    size: 18.0,
                },
            ],
        },
        RoomDef {
            id: "candy".into(),
            name: "Конфетная страна".into(),
            emoji: "🍭".into(),
            description: "Сладкий сказочный мир".into(),
            price: 250,
            gradient: "linear-gradient(180deg, #FCE7F3 0%, #FDF2F8 50%, #FECDD3 100%)".into(),
            floor_gradient: "linear-gradient(180deg, transparent, rgba(236,72,153,0.12))".into(),
            decorations: vec![
                RoomDecoration {
                    emoji: "🍭".into(),
                    x: 5.0,
                    y: 58.0,
                    size: 32.0,
                },
                RoomDecoration {
                    emoji: "🍬".into(),
                    x: 80.0,
                    y: 60.0,
                    size: 26.0,
                },
                RoomDecoration {
                    emoji: "🎀".into(),
                    x: 75.0,
                    y: 12.0,
                    size: 24.0,
                },
                RoomDecoration {
                    emoji: "🍰".into(),
                    x: 48.0,
                    y: 72.0,
                    size: 22.0,
                },
            ],
        },
    ]
}

// ─── Achievements ─────────────────────────────────────────────────────────────

pub fn achievement_defs() -> Vec<AchievementDef> {
    vec![
        AchievementDef {
            id: "first_meal".into(),
            name: "Первая трапеза".into(),
            emoji: "🍽".into(),
            category: AchievementCategory::Care,
            description: "Покорми питомца в первый раз".into(),
            target: 1,
            reward: 15,
        },
        AchievementDef {
            id: "food_lover".into(),
            name: "Любитель поесть".into(),
            emoji: "🍴".into(),
            category: AchievementCategory::Care,
            description: "Покорми питомца 25 раз".into(),
            target: 25,
            reward: 40,
        },
        AchievementDef {
            id: "full_menu".into(),
            name: "Полное меню".into(),
            emoji: "📋".into(),
            category: AchievementCategory::Care,
            description: "Попробуй все 8 видов еды".into(),
            target: 8,
            reward: 55,
        },
        AchievementDef {
            id: "clean_freak".into(),
            name: "Чистюля".into(),
            emoji: "🛁".into(),
            category: AchievementCategory::Care,
            description: "Помой питомца 5 раз".into(),
            target: 5,
            reward: 25,
        },
        AchievementDef {
            id: "good_doctor".into(),
            name: "Добрый доктор".into(),
            emoji: "💊".into(),
            category: AchievementCategory::Care,
            description: "Вылечи питомца 3 раза".into(),
            target: 3,
            reward: 20,
        },
        AchievementDef {
            id: "sweet_dreams".into(),
            name: "Сладких снов".into(),
            emoji: "😴".into(),
            category: AchievementCategory::Care,
            description: "Уложи питомца спать 5 раз".into(),
            target: 5,
            reward: 20,
        },
        AchievementDef {
            id: "best_friends".into(),
            name: "Лучшие друзья".into(),
            emoji: "💜".into(),
            category: AchievementCategory::Social,
            description: "Обними питомца 20 раз".into(),
            target: 20,
            reward: 45,
        },
        AchievementDef {
            id: "max_bond".into(),
            name: "Нераздельные".into(),
            emoji: "💞".into(),
            category: AchievementCategory::Social,
            description: "Доведи Связь до максимума (100)".into(),
            target: 100,
            reward: 70,
        },
        AchievementDef {
            id: "playful".into(),
            name: "Игривый".into(),
            emoji: "🎮".into(),
            category: AchievementCategory::Play,
            description: "Поиграй с питомцем 10 раз".into(),
            target: 10,
            reward: 30,
        },
        AchievementDef {
            id: "star_catcher".into(),
            name: "Ловец звёзд".into(),
            emoji: "⭐".into(),
            category: AchievementCategory::Play,
            description: "Набери 150 очков в игре со звёздами".into(),
            target: 150,
            reward: 40,
        },
        AchievementDef {
            id: "level_5".into(),
            name: "Новичок".into(),
            emoji: "⭐".into(),
            category: AchievementCategory::Progress,
            description: "Достигни 5 уровня".into(),
            target: 5,
            reward: 50,
        },
        AchievementDef {
            id: "level_10".into(),
            name: "Опытный".into(),
            emoji: "🌟".into(),
            category: AchievementCategory::Progress,
            description: "Достигни 10 уровня".into(),
            target: 10,
            reward: 100,
        },
        AchievementDef {
            id: "growing_up".into(),
            name: "Взросление".into(),
            emoji: "🌱".into(),
            category: AchievementCategory::Progress,
            description: "Питомец стал Подростком".into(),
            target: 1,
            reward: 75,
        },
        AchievementDef {
            id: "healthy_streak".into(),
            name: "Здоровяк".into(),
            emoji: "💪".into(),
            category: AchievementCategory::Progress,
            description: "Держи Здоровье > 80 в 10 синхронизациях".into(),
            target: 10,
            reward: 45,
        },
        AchievementDef {
            id: "shopaholic".into(),
            name: "Шопоголик".into(),
            emoji: "🛒".into(),
            category: AchievementCategory::Shop,
            description: "Купи 5 предметов в магазине".into(),
            target: 5,
            reward: 30,
        },
        AchievementDef {
            id: "collector".into(),
            name: "Коллекционер".into(),
            emoji: "🏅".into(),
            category: AchievementCategory::Shop,
            description: "Купи 15 предметов в магазине".into(),
            target: 15,
            reward: 75,
        },
        AchievementDef {
            id: "room_owner".into(),
            name: "Домовладелец".into(),
            emoji: "🏠".into(),
            category: AchievementCategory::Shop,
            description: "Купи любую новую комнату".into(),
            target: 1,
            reward: 40,
        },
    ]
}

// ─── Quests ───────────────────────────────────────────────────────────────────

pub fn quest_defs() -> Vec<QuestDef> {
    vec![
        QuestDef {
            id: "q_feed3".into(),
            name: "Утренний завтрак".into(),
            emoji: "🍳".into(),
            description: "Покорми питомца 3 раза сегодня".into(),
            target: 32,
            reward: QuestReward { coins: 20, xp: 60 },
        },
        QuestDef {
            id: "q_play2".into(),
            name: "Время игр".into(),
            emoji: "🎮".into(),
            description: "Поиграй 2 раза сегодня".into(),
            target: 2,
            reward: QuestReward { coins: 25, xp: 80 },
        },
        QuestDef {
            id: "q_bathe".into(),
            name: "Банный день".into(),
            emoji: "🛁".into(),
            description: "Помой питомца сегодня".into(),
            target: 1,
            reward: QuestReward { coins: 15, xp: 40 },
        },
        QuestDef {
            id: "q_bond3".into(),
            name: "День объятий".into(),
            emoji: "🤗".into(),
            description: "Обними питомца 3 раза".into(),
            target: 3,
            reward: QuestReward { coins: 20, xp: 55 },
        },
        QuestDef {
            id: "q_buy".into(),
            name: "Поход в магазин".into(),
            emoji: "🛒".into(),
            description: "Купи любой предмет в магазине".into(),
            target: 1,
            reward: QuestReward { coins: 10, xp: 30 },
        },
        QuestDef {
            id: "q_heal".into(),
            name: "Забота о здоровье".into(),
            emoji: "💊".into(),
            description: "Вылечи питомца или дай витамин".into(),
            target: 1,
            reward: QuestReward { coins: 15, xp: 35 },
        },
    ]
}
