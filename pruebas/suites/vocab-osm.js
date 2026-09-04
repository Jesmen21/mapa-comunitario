// Vocabulario real de OpenStreetMap para las 10 claves que URBIS le pide a
// Overpass (ver js/61-analisis-ia-datos.js). Es la lista contra la que se
// mide si la Matriz de Usos sabe leer lo que puede llegar del mapa.
module.exports = {
  amenity: [
    // Comida y bebida
    'restaurant','fast_food','cafe','bar','pub','food_court','ice_cream','biergarten','juice_bar',
    // Educación
    'school','kindergarten','college','university','language_school','driving_school','music_school',
    'research_institute','training','childcare','prep_school',
    // Transporte
    'parking','parking_space','parking_entrance','bicycle_parking','motorcycle_parking','bicycle_rental',
    'bicycle_repair_station','car_rental','car_sharing','car_wash','fuel','charging_station','taxi',
    'bus_station','ferry_terminal','driving_range','motorcycle_rental','vehicle_inspection',
    // Finanzas
    'bank','atm','bureau_de_change','money_transfer','payment_centre','payment_terminal',
    // Salud
    'pharmacy','hospital','clinic','doctors','dentist','veterinary','nursing_home','social_facility',
    'blood_donation','baby_hatch','first_aid','health_post',
    // Cultura, ocio, culto
    'cinema','theatre','library','arts_centre','community_centre','social_centre','studio','casino',
    'nightclub','gambling','stripclub','brothel','love_hotel','music_venue','events_venue',
    'exhibition_centre','conference_centre','planetarium','public_bookcase',
    'place_of_worship','monastery','grave_yard','funeral_hall','crematorium',
    // Público y gobierno
    'townhall','courthouse','police','fire_station','prison','post_office','post_depot','post_box',
    'embassy','public_building','register_office','customs','ranger_station','shelter','refugee_site',
    // Servicios urbanos
    'toilets','drinking_water','water_point','fountain','bench','waste_basket','waste_disposal',
    'waste_transfer_station','recycling','sanitary_dump_station','shower','telephone','clock',
    'vending_machine','photo_booth','luggage_locker','lounger','give_box',
    // Otros
    'marketplace','animal_shelter','animal_boarding','veterinary_pharmacy','hunting_stand',
    'internet_cafe','coworking_space','gym','dojo','public_bath','sauna','smoking_area',
    'kitchen','bbq','watering_place','trolley_bay','vacuum_cleaner',
    'compressed_air','device_charging_station','mobile_money_agent','stage','loading_dock'
  ],
  shop: [
    // Alimentación
    'supermarket','convenience','grocery','greengrocer','butcher','bakery','pastry','confectionery',
    'seafood','deli','cheese','chocolate','coffee','tea','alcohol','beverages','wine','water',
    'farm','dairy','spices','health_food','nuts','frozen_food','food',
    // Ropa y cuidado personal
    'clothes','shoes','bag','boutique','fashion_accessories','jewelry','watches','leather',
    'fabric','sewing','tailor','dry_cleaning','laundry','hairdresser','beauty','cosmetics',
    'perfumery','tattoo','massage','optician','hearing_aids','erotic','baby_goods','second_hand',
    // Hogar y construcción
    'furniture','interior_decoration','kitchen','bed','curtain','carpet','houseware','hardware',
    'doityourself','trade','paint','tiles','flooring','glaziery','locksmith','electrical',
    'plumbing','bathroom_furnishing','garden_centre','florist','pottery','window_blind',
    'appliance','lighting','building_materials','fireplace','swimming_pool',
    // Tecnología y oficina
    'electronics','computer','mobile_phone','telecommunication','hifi','video_games','camera',
    'photo','copyshop','stationery','books','newsagent','printer_ink','office_supplies','ticket',
    // Vehículos
    'car','car_repair','car_parts','motorcycle','motorcycle_repair','motorcycle_parts','bicycle',
    'tyres','truck','truck_repair','caravan','boat','fuel','atv','agrarian',
    // Salud y varios
    'chemist','medical_supply','herbalist','nutrition_supplements','pet','pet_grooming','veterinary',
    'toys','sports','outdoor','hunting','fishing','games','musical_instrument','music','video',
    'art','craft','frame','gift','party','religion','funeral_directors','money_lender','pawnbroker',
    'travel_agency','estate_agent','insurance','bookmaker','lottery','tobacco','e-cigarette',
    'variety_store','department_store','mall','wholesale','kiosk','general','hardware_store',
    'rental','storage_rental','charity','vacant','yes','trade_centre','houseplant','collector'
  ],
  leisure: [
    'park','garden','playground','pitch','sports_centre','sports_hall','stadium','track','golf_course',
    'miniature_golf','swimming_pool','swimming_area','water_park','fitness_centre','fitness_station',
    'dance','horse_riding','marina','slipway','fishing','nature_reserve','dog_park','common',
    'bowling_alley','amusement_arcade','adult_gaming_centre','escape_game','hackerspace','bandstand',
    'bleachers','picnic_table','firepit','outdoor_seating','beach_resort','resort','sauna','trampoline_park'
  ],
  tourism: [
    'hotel','motel','hostel','guest_house','apartment','chalet','camp_site','caravan_site','alpine_hut',
    'wilderness_hut','museum','gallery','artwork','attraction','viewpoint','picnic_site','theme_park',
    'zoo','aquarium','information','yes'
  ],
  office: [
    'company','government','lawyer','accountant','architect','engineer','estate_agent','insurance',
    'financial','financial_advisor','notary','tax_advisor','it','telecommunication','advertising_agency',
    'newspaper','ngo','association','political_party','religion','employment_agency','educational_institution',
    'research','logistics','travel_agent','coworking','diplomatic','property_management','construction_company',
    'consulting','graphic_design','moving_company','security','water_utility','energy_supplier','charity',
    'foundation','union','courier','visa','forestry','surveyor','yes'
  ],
  healthcare: [
    'hospital','clinic','doctor','dentist','pharmacy','laboratory','physiotherapist','psychotherapist',
    'optometrist','alternative','birthing_centre','blood_donation','centre','midwife','nurse',
    'occupational_therapist','podiatrist','rehabilitation','sample_collection','speech_therapist',
    'vaccination_centre','dialysis','audiologist','counselling','yes'
  ],
  landuse: [
    'residential','commercial','retail','industrial','construction','brownfield','greenfield','farmland',
    'farmyard','orchard','vineyard','meadow','forest','grass','village_green','recreation_ground',
    'cemetery','religious','allotments','quarry','landfill','military','railway','garages','depot',
    'port','education','institutional','plant_nursery','aquaculture','basin','salt_pond','greenhouse_horticulture'
  ],
  building: [
    'house','residential','apartments','detached','semidetached_house','terrace','bungalow','cabin','hut',
    'dormitory','farm','static_caravan','commercial','retail','office','industrial','warehouse','supermarket',
    'kiosk','hotel','school','university','college','kindergarten','hospital','clinic','church','chapel',
    'cathedral','mosque','temple','synagogue','civic','government','public','fire_station','train_station',
    'transportation','stadium','sports_hall','sports_centre','pavilion','riding_hall','barn','cowshed',
    'greenhouse','stable','sty','storage_tank','silo','service','garage','garages','carport','shed',
    'roof','hangar','bunker','construction','ruins','container','tent','toilets','bakehouse','multiusos'
  ],
  sport: [
    'fitness','gym','crossfit','weightlifting','bodybuilding','soccer','football','basketball','volleyball',
    'tennis','swimming','athletics','baseball','boxing','martial_arts','judo','karate','taekwondo','yoga',
    'pilates','cycling','running','skateboard','climbing','table_tennis','badminton','handball','rugby',
    'golf','equestrian','dance','billiards','bowls','chess','multi','padel','futsal','racquet'
  ],
  natural: ['water','wetland','wood','scrub','grassland']
};
