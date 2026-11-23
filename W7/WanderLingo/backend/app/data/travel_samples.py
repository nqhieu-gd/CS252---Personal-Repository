"""Curated travel datasets grounded directly in '2025 CT - API Translate.docx.pdf'.

Includes the exact examples from Sections 4 and 6 of the professor's tutorial
alongside additional global travel samples for interactive testing.
"""
from __future__ import annotations

from typing import Any, Dict, List

# Section 6, Example 3: Travel Destination Information Translator
# Note: 'hanoi' includes the exact 5 string fields from page 11 of the tutorial,
# plus non-string fields (rating, avg_daily_budget_usd, unesco_sites) to demonstrate
# non-string preservation (`if isinstance(value, str) and value.strip()`).
SAMPLE_DESTINATIONS: List[Dict[str, Any]] = [
    {
        "id": "hanoi",
        "badge": "Tutorial Example 3",
        "country": "Vietnam",
        "data": {
            "name": "Hanoi",
            "description": "The capital city of Vietnam, known for its rich history and vibrant street food culture.",
            "attractions": "Hoan Kiem Lake, Old Quarter, Temple of Literature, Ho Chi Minh Mausoleum",
            "food_specialties": "Pho, Bun Cha, Banh Mi, Vietnamese Coffee",
            "best_time_to_visit": "October to April when the weather is cool and dry",
            "local_tip": "Try traditional egg coffee (Ca Phe Trung) in a hidden Old Quarter balcony cafe.",
            "avg_daily_budget_usd": 45,
            "visitor_rating": 4.8,
            "unesco_heritage_sites": 1,
        },
    },
    {
        "id": "hcmc",
        "badge": "Vietnam Highlight",
        "country": "Vietnam",
        "data": {
            "name": "Ho Chi Minh City",
            "description": "Vietnam's bustling southern metropolis blending French colonial landmarks, modern skyscrapers, and lively night markets.",
            "attractions": "Ben Thanh Market, Independence Palace, Notre-Dame Cathedral Basilica, Nguyen Hue Walking Street",
            "food_specialties": "Com Tam (Broken Rice), Banh Xeo, Hu Tieu Nam Vang, Iced Milk Coffee (Ca Phe Sua Da)",
            "best_time_to_visit": "December to April during the sunny dry season",
            "local_tip": "Take a sunset waterbus ride along the Saigon River from Bach Dang Pier.",
            "avg_daily_budget_usd": 50,
            "visitor_rating": 4.7,
            "unesco_heritage_sites": 0,
        },
    },
    {
        "id": "danang",
        "badge": "Coastal Hub",
        "country": "Vietnam",
        "data": {
            "name": "Da Nang & Hoi An",
            "description": "A scenic central coastal hub famed for sandy beaches, marble peaks, dragon bridges, and lantern-lit heritage streets nearby.",
            "attractions": "Dragon Bridge, Marble Mountains, My Khe Beach, Ba Na Hills Golden Bridge, Hoi An Ancient Town",
            "food_specialties": "Mi Quang, Cao Lau, Banh Trang Cuon Thit Heo, Fresh Grilled Seafood",
            "best_time_to_visit": "February to August for calm seas and clear beach weather",
            "local_tip": "Watch the Dragon Bridge breathe fire and water at 9:00 PM on Saturday and Sunday nights.",
            "avg_daily_budget_usd": 48,
            "visitor_rating": 4.9,
            "unesco_heritage_sites": 2,
        },
    },
    {
        "id": "hue",
        "badge": "Imperial Capital",
        "country": "Vietnam",
        "data": {
            "name": "Hue",
            "description": "Vietnam's former Nguyen Dynasty imperial capital along the Perfume River, renowned for royal citadels, garden houses, and refined royal cuisine.",
            "attractions": "Hue Imperial City (The Citadel), Thien Mu Pagoda, Tomb of Khai Dinh, Tomb of Minh Mang, Trang Tien Bridge",
            "food_specialties": "Bun Bo Hue, Banh Beo, Banh Khoai, Com Hen (Clam Rice), Che Hue (Royal Sweet Soups)",
            "best_time_to_visit": "January to April for cool spring weather and blooming gardens",
            "local_tip": "Rent a bicycle or take a dragon boat along the Perfume River at dawn to visit riverside royal tombs.",
            "avg_daily_budget_usd": 40,
            "visitor_rating": 4.8,
            "unesco_heritage_sites": 1,
        },
    },
    {
        "id": "dalat",
        "badge": "Highland Retreat",
        "country": "Vietnam",
        "data": {
            "name": "Da Lat",
            "description": "A misty Central Highlands mountain town surrounded by pine forests, waterfalls, flower farms, and French-era villas.",
            "attractions": "Xuan Huong Lake, Langbiang Mountain, Datanla Waterfall, Da Lat Railway Station, Cau Dat Tea Hill",
            "food_specialties": "Banh Trang Nuong (Vietnamese Pizza), Banh Can, Chicken Hotpot with Eclair Leaves (Lau Ga La E), Hot Soy Milk, Artichoke Tea",
            "best_time_to_visit": "November to March during the dry season when wild sunflowers and cherry blossoms bloom",
            "local_tip": "Pack a warm jacket for early morning cloud-hunting trips at Cau Dat Tea Hill.",
            "avg_daily_budget_usd": 42,
            "visitor_rating": 4.8,
            "unesco_heritage_sites": 0,
        },
    },
    {
        "id": "phuquoc",
        "badge": "Pearl Island",
        "country": "Vietnam",
        "data": {
            "name": "Phu Quoc",
            "description": "Vietnam's largest tropical island in the Gulf of Thailand, celebrated for white-sand beaches, coral reefs, pepper farms, and sunset fishing villages.",
            "attractions": "Sao Beach, Hon Thom Cable Car, Phu Quoc National Park, Dinh Cau Night Market, Ham Ninh Fishing Village",
            "food_specialties": "Bun Quay Kien Xay, Herring Salad (Goi Ca Trich), Grilled Sea Urchin, Ham Ninh Steamed Crab, Phu Quoc Fish Sauce Dishes",
            "best_time_to_visit": "November to April for calm turquoise waters and sunny skies",
            "local_tip": "Book a southern island snorkeling boat tour to Finger Island and May Rut Island.",
            "avg_daily_budget_usd": 60,
            "visitor_rating": 4.8,
            "unesco_heritage_sites": 0,
        },
    },
    {
        "id": "vungtau",
        "badge": "Southern Coast",
        "country": "Vietnam",
        "data": {
            "name": "Vung Tau",
            "description": "A breezy coastal peninsula just two hours from Ho Chi Minh City, famous for oceanfront promenades, hilltop landmarks, and fresh seafood.",
            "attractions": "Christ the King Statue, Vung Tau Lighthouse, Back Beach (Bai Sau), Front Beach Park, Nghinh Phong Cape",
            "food_specialties": "Banh Khot (Crispy Mini Shrimp Pancakes), Stingray Hotpot (Lau Ca Duoi), Salted Egg Sponge Cake, Fresh Grilled Octopus",
            "best_time_to_visit": "November to April for dry coastal breezes and clear viewpoint vistas",
            "local_tip": "Climb up to Vung Tau Lighthouse before sunset for a 360-degree view of the peninsula and enjoy yogurt with soft-boiled eggs nearby.",
            "avg_daily_budget_usd": 42,
            "visitor_rating": 4.6,
            "unesco_heritage_sites": 0,
        },
    },
    {
        "id": "quynhon",
        "badge": "Hidden Gem Coast",
        "country": "Vietnam",
        "data": {
            "name": "Quy Nhon",
            "description": "A laid-back central coastal city where dramatic rocky headlands, turquoise bays, and ancient Cham towers meet uncrowded beaches.",
            "attractions": "Ky Co Beach, Eo Gio Windy Strait, Thap Doi Twin Cham Towers, Banh It Cham Temple, Queen's Beach (Bai Tam Hoang Hau)",
            "food_specialties": "Banh Xeo Tom Nhay (Jumping Shrimp Crispy Crepe), Bun Cha Ca Quy Nhon (Fish Cake Noodle Soup), Banh Hoi Chao Long, Tre Binh Dinh",
            "best_time_to_visit": "March to August for crystal-clear water at Ky Co and Eo Gio",
            "local_tip": "Walk the coastal cliffside path at Eo Gio in the late afternoon when the sea breeze cools the rocks.",
            "avg_daily_budget_usd": 38,
            "visitor_rating": 4.9,
            "unesco_heritage_sites": 0,
        },
    },
]

# Section 6, Example 1: Hotel Review Translation System
# The first 3 entries are the EXACT Vietnamese reviews from page 7 of the tutorial.
SAMPLE_HOTEL_REVIEWS: List[Dict[str, Any]] = [
    {
        "id": "rev-tutorial-1",
        "author": "Minh Anh (Tutorial Sample #1)",
        "hotel_name": "Hanoi Heritage Boutique Hotel",
        "rating": 5.0,
        "stay_date": "2026-10-14",
        "text": "Khách sạn này rất tuyệt vời! Nhân viên thân thiện.",
    },
    {
        "id": "rev-tutorial-2",
        "author": "Quốc Bảo (Tutorial Sample #2)",
        "hotel_name": "Da Nang Oceanfront Resort",
        "rating": 4.5,
        "stay_date": "2026-10-19",
        "text": "Vị trí khách sạn thuận tiện, gần biển.",
    },
    {
        "id": "rev-tutorial-3",
        "author": "Thu Hà (Tutorial Sample #3)",
        "hotel_name": "Old Quarter Cozy Stay",
        "rating": 4.0,
        "stay_date": "2026-10-25",
        "text": "Phòng sạch sẽ nhưng hơi nhỏ.",
    },
    {
        "id": "rev-en-4",
        "author": "Emma Watson (UK)",
        "hotel_name": "Saigon Riverside Grand",
        "rating": 5.0,
        "stay_date": "2026-11-02",
        "text": "The rooftop breakfast overlooking the river was unforgettable, and airport pickup was right on time.",
    },
    {
        "id": "rev-ja-5",
        "author": "Kenji Takahashi (Japan)",
        "hotel_name": "Hanoi Heritage Boutique Hotel",
        "rating": 5.0,
        "stay_date": "2026-11-05",
        "text": "部屋はとても静かで清潔でした。朝食のフォーが最高に美味しかったです！",
    },
    {
        "id": "rev-fr-6",
        "author": "Claire Dubois (France)",
        "hotel_name": "Hoi An Lantern Villa",
        "rating": 4.5,
        "stay_date": "2026-11-09",
        "text": "Magnifique hôtel près de la vieille ville, personnel très serviable et piscine agréable.",
    },
    {
        "id": "rev-es-7",
        "author": "Mateo Rodríguez (Spain)",
        "hotel_name": "Da Nang Oceanfront Resort",
        "rating": 4.5,
        "stay_date": "2026-11-12",
        "text": "Excelente ubicación frente a la playa, habitaciones amplias y muy buena atención en recepción.",
    },
    {
        "id": "rev-ko-8",
        "author": "Jisoo Park (South Korea)",
        "hotel_name": "Saigon Riverside Grand",
        "rating": 5.0,
        "stay_date": "2026-11-15",
        "text": "수영장 전망이 정말 멋지고 직원분들이 체크인할 때 친절하게 도와주셨어요.",
    },
]

# Section 6, Example 2: Travel Inquiry Language Processor
# Includes the exact 4 multilingual inquiries from page 9 of the tutorial.
SAMPLE_TRAVEL_INQUIRIES: List[Dict[str, Any]] = [
    {
        "id": "inq-tutorial-1",
        "guest_name": "Nguyễn Hoàng Nam",
        "channel": "Website Chat",
        "badge": "Tutorial Sample #1 (VI)",
        "inquiry_text": "Tôi muốn đặt phòng khách sạn ở Hà Nội",
        "suggested_reply_en": "We would be happy to reserve your room in Hanoi! Which check-in and check-out dates do you prefer?",
    },
    {
        "id": "inq-tutorial-2",
        "guest_name": "Alex Carter",
        "channel": "Email Desk",
        "badge": "Tutorial Sample #2 (EN — Same-Lang Test)",
        "inquiry_text": "I want to book a hotel in Hanoi",
        "suggested_reply_en": "Thank you for reaching out! Our standard and deluxe rooms in Hanoi are available this week.",
    },
    {
        "id": "inq-tutorial-3",
        "guest_name": "Sofía Martínez",
        "channel": "WhatsApp Concierge",
        "badge": "Tutorial Sample #3 (ES)",
        "inquiry_text": "¿Hay tours disponibles para mañana?",
        "suggested_reply_en": "Yes, we have both a morning Old Quarter walking tour and an afternoon street food tour available tomorrow.",
    },
    {
        "id": "inq-tutorial-4",
        "guest_name": "Yuki Tanaka",
        "channel": "Booking Portal",
        "badge": "Tutorial Sample #4 (JA)",
        "inquiry_text": "空港からホテルまでの交通手段は？",
        "suggested_reply_en": "We offer a private airport shuttle service (40 minutes), or you can take Express Bus 86 directly to the Old Quarter.",
    },
    {
        "id": "inq-fr-5",
        "guest_name": "Lucas Bernard",
        "channel": "Front Desk Message",
        "badge": "French Guest (FR)",
        "inquiry_text": "Bonjour, est-il possible d'avoir un départ tardif à 15h00 et une option végétarienne au petit-déjeuner ?",
        "suggested_reply_en": "Late check-out at 3:00 PM is complimentary for your booking, and our kitchen prepares fresh vegetarian dishes daily.",
    },
    {
        "id": "inq-ko-6",
        "guest_name": "Minho Kim",
        "channel": "Mobile App",
        "badge": "Korean Guest (KO)",
        "inquiry_text": "다낭 공항 픽업 서비스를 예약하고 싶은데 항공편 번호를 알려드리면 되나요?",
        "suggested_reply_en": "Yes, please send us your flight number and arrival time, and our driver will wait at the arrival gate with a name sign.",
    },
]

# Essential Travel Phrasebook presets for Workspace 1
SAMPLE_PHRASEBOOK: List[Dict[str, Any]] = [
    {
        "category": "hotel",
        "label_en": "Hotel & Check-In",
        "label_vi": "Khách sạn & Nhận phòng",
        "phrases": [
            "Welcome to our hotel",
            "Thank you for staying with us",
            "Have a safe trip",
            "I have a hotel reservation under my name. Could I check in early?",
            "What time is breakfast served, and is Wi-Fi included?",
        ],
    },
    {
        "category": "transport",
        "label_en": "Airport & Directions",
        "label_vi": "Sân bay & Di chuyển",
        "phrases": [
            "¿Dónde está el hotel?",
            "How do I get from the airport to the city center by train or bus?",
            "Could you please write down the address in the local language for the taxi driver?",
            "How much does a ticket to the central station cost?",
        ],
    },
    {
        "category": "dining",
        "label_en": "Dining & Food Safety",
        "label_vi": "Ẩm thực & Nhà hàng",
        "phrases": [
            "What is the most famous local specialty at this restaurant?",
            "I have a peanut and shellfish allergy. Does this dish contain either of them?",
            "Could we have the bill, please? Everything was delicious!",
        ],
    },
    {
        "category": "emergency",
        "label_en": "Help & Emergency",
        "label_vi": "Khẩn cấp & Hỗ trợ",
        "phrases": [
            "Excuse me, I lost my passport. Where is the nearest police station or embassy?",
            "I need a pharmacy or a doctor who speaks English or Vietnamese.",
        ],
    },
]
