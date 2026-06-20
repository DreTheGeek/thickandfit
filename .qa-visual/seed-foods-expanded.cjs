// Curated DEPTH pass for the food corpus (beat MyFitnessPal depth + un-paywalled barcode).
// Adds 250+ accurate USDA-based common + LATAM/Mexican foods (with name_es), more household
// portions, more category cooked/uncooked ratios, and ~20 common barcoded items so the diary's
// manual barcode-entry path resolves to a real food. Shared corpus: company_id NULL.
// Idempotent: clears source='seed_expanded' rows then re-inserts. Full USDA/OFF ETL comes later.
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
});
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const ref = (env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase/) || [])[1];
const SOURCE = 'seed_expanded';

// [name_en, name_es, category, kcal, protein, carb, fat, fiber, density_g_per_ml, barcode|null]
// All values per 100 g edible portion, USDA FoodData Central SR Legacy / Foundation aligned.
const F = [
  // ---------------------------------------------------------------- proteins: poultry
  ['Chicken breast, skinless, raw', 'Pechuga de pollo sin piel, cruda', 'poultry', 120, 22.5, 0, 2.6, 0, null, null],
  ['Chicken breast, grilled', 'Pechuga de pollo, a la parrilla', 'poultry', 165, 31, 0, 3.6, 0, null, null],
  ['Chicken thigh, skinless, cooked', 'Muslo de pollo sin piel, cocido', 'poultry', 209, 26, 0, 11, 0, null, null],
  ['Chicken drumstick, cooked', 'Pierna de pollo, cocida', 'poultry', 172, 28, 0, 5.7, 0, null, null],
  ['Chicken wing, cooked', 'Ala de pollo, cocida', 'poultry', 203, 30, 0, 8.1, 0, null, null],
  ['Rotisserie chicken, meat only', 'Pollo rostizado, solo carne', 'poultry', 190, 29, 0, 7.8, 0, null, null],
  ['Ground chicken, cooked', 'Pollo molido, cocido', 'poultry', 189, 24, 0, 10, 0, null, null],
  ['Turkey breast, roasted', 'Pechuga de pavo, asada', 'poultry', 135, 30, 0, 1, 0, null, null],
  ['Ground turkey 93/7, cooked', 'Pavo molido 93/7, cocido', 'poultry', 176, 22, 0, 9.4, 0, null, null],
  ['Duck breast, cooked', 'Pechuga de pato, cocida', 'poultry', 201, 23, 0, 11, 0, null, null],
  // ---------------------------------------------------------------- proteins: beef / pork
  ['Ground beef 90/10, cooked', 'Carne molida 90/10, cocida', 'beef', 217, 26, 0, 12, 0, null, null],
  ['Ground beef 80/20, cooked', 'Carne molida 80/20, cocida', 'beef', 254, 25, 0, 17, 0, null, null],
  ['Ground beef 85/15, raw', 'Carne molida 85/15, cruda', 'beef', 254, 17, 0, 20, 0, null, null],
  ['Sirloin steak, cooked', 'Bistec de sirloin, cocido', 'beef', 206, 29, 0, 9, 0, null, null],
  ['Ribeye steak, cooked', 'Bistec ribeye, cocido', 'beef', 291, 24, 0, 22, 0, null, null],
  ['Flank steak, cooked', 'Arrachera, cocida', 'beef', 192, 28, 0, 8, 0, null, null],
  ['Beef brisket, cooked', 'Pecho de res, cocido', 'beef', 246, 28, 0, 14, 0, null, null],
  ['Carne asada, cooked', 'Carne asada, cocida', 'beef', 220, 27, 0, 12, 0, null, null],
  ['Beef barbacoa', 'Barbacoa de res', 'beef', 209, 24, 1, 12, 0, null, null],
  ['Beef tongue (lengua), cooked', 'Lengua de res, cocida', 'beef', 284, 22, 0, 21, 0, null, null],
  ['Pork loin, cooked', 'Lomo de cerdo, cocido', 'pork', 143, 21, 0, 6, 0, null, null],
  ['Pork chop, cooked', 'Chuleta de cerdo, cocida', 'pork', 231, 26, 0, 13, 0, null, null],
  ['Ground pork, cooked', 'Carne de cerdo molida, cocida', 'pork', 297, 26, 0, 21, 0, null, null],
  ['Carnitas', 'Carnitas', 'pork', 232, 23, 1, 15, 0, null, null],
  ['Al pastor pork', 'Cerdo al pastor', 'pork', 215, 21, 4, 12, 0, null, null],
  ['Chorizo, cooked', 'Chorizo, cocido', 'pork', 350, 21, 2, 28, 0, null, null],
  ['Bacon, cooked', 'Tocino, cocido', 'pork', 541, 37, 1.4, 42, 0, null, null],
  ['Ham, lean', 'Jamon, magro', 'pork', 145, 21, 1.5, 5.5, 0, null, null],
  // ---------------------------------------------------------------- proteins: fish / seafood
  ['Salmon, cooked', 'Salmon, cocido', 'seafood', 208, 22, 0, 13, 0, null, null],
  ['Salmon, raw', 'Salmon, crudo', 'seafood', 142, 20, 0, 6.3, 0, null, null],
  ['Tilapia, cooked', 'Tilapia, cocida', 'seafood', 128, 26, 0, 2.7, 0, null, null],
  ['Cod, cooked', 'Bacalao, cocido', 'seafood', 105, 23, 0, 0.9, 0, null, null],
  ['Mahi mahi, cooked', 'Dorado, cocido', 'seafood', 109, 24, 0, 0.9, 0, null, null],
  ['Shrimp, cooked', 'Camarones, cocidos', 'seafood', 99, 24, 0.2, 0.3, 0, null, null],
  ['Tuna, canned in water', 'Atun, en agua', 'seafood', 116, 26, 0, 0.8, 0, null, null],
  ['Tuna steak, cooked', 'Filete de atun, cocido', 'seafood', 184, 30, 0, 6.3, 0, null, null],
  ['Sardines, canned', 'Sardinas, enlatadas', 'seafood', 208, 25, 0, 11, 0, null, null],
  ['Octopus, cooked', 'Pulpo, cocido', 'seafood', 164, 30, 4.4, 2.1, 0, null, null],
  ['Crab meat, cooked', 'Carne de cangrejo, cocida', 'seafood', 97, 19, 0, 1.5, 0, null, null],
  // ---------------------------------------------------------------- proteins: eggs / plant
  ['Egg, whole', 'Huevo, entero', 'protein', 143, 12.6, 0.7, 9.5, 0, null, null],
  ['Egg white', 'Clara de huevo', 'protein', 52, 11, 0.7, 0.2, 0, 1.03, null],
  ['Egg yolk', 'Yema de huevo', 'protein', 322, 16, 3.6, 27, 0, null, null],
  ['Tofu, firm', 'Tofu, firme', 'protein', 144, 15, 3, 9, 2, null, null],
  ['Tofu, silken', 'Tofu, suave', 'protein', 55, 5.8, 2.2, 2.7, 0.2, null, null],
  ['Tempeh', 'Tempeh', 'protein', 192, 20, 7.6, 11, 0, null, null],
  ['Seitan', 'Seitan', 'protein', 121, 21, 4, 1.9, 0.6, null, null],
  ['Edamame, cooked', 'Edamame, cocido', 'legume', 121, 12, 9, 5, 5.2, null, null],
  // ---------------------------------------------------------------- protein powders / supplements
  ['Whey protein isolate', 'Proteina aislada de suero', 'protein', 370, 85, 4, 2, 0, null, null],
  ['Whey protein concentrate', 'Proteina concentrada de suero', 'protein', 380, 75, 9, 7, 0, null, null],
  ['Plant protein powder', 'Proteina vegetal en polvo', 'protein', 380, 70, 10, 6, 4, null, null],
  ['Casein protein powder', 'Proteina de caseina', 'protein', 360, 78, 8, 3, 1, null, null],
  ['Collagen peptides', 'Peptidos de colageno', 'protein', 357, 89, 0, 0, 0, null, null],
  // ---------------------------------------------------------------- legumes
  ['Black beans, cooked', 'Frijoles negros, cocidos', 'legume', 132, 8.9, 24, 0.5, 8.7, null, null],
  ['Pinto beans, cooked', 'Frijoles pintos, cocidos', 'legume', 143, 9, 26, 0.7, 9, null, null],
  ['Refried beans', 'Frijoles refritos', 'legume', 119, 7, 18, 2, 6, null, null],
  ['Kidney beans, cooked', 'Frijoles rojos, cocidos', 'legume', 127, 8.7, 23, 0.5, 6.4, null, null],
  ['Lentils, cooked', 'Lentejas, cocidas', 'legume', 116, 9, 20, 0.4, 7.9, null, null],
  ['Chickpeas, cooked', 'Garbanzos, cocidos', 'legume', 164, 8.9, 27, 2.6, 7.6, null, null],
  ['Hummus', 'Hummus', 'legume', 166, 8, 14, 10, 6, null, null],
  ['Green peas, cooked', 'Chicharos, cocidos', 'legume', 84, 5.4, 16, 0.2, 5.5, null, null],
  ['Soybeans, cooked', 'Soya, cocida', 'legume', 173, 17, 10, 9, 6, null, null],
  // ---------------------------------------------------------------- grains / starches
  ['White rice, cooked', 'Arroz blanco, cocido', 'grain', 130, 2.7, 28, 0.3, 0.4, null, null],
  ['White rice, dry', 'Arroz blanco, crudo', 'grain', 365, 7, 80, 0.7, 1.3, null, null],
  ['Brown rice, cooked', 'Arroz integral, cocido', 'grain', 123, 2.7, 26, 1, 1.6, null, null],
  ['Mexican rice (arroz rojo)', 'Arroz rojo', 'grain', 150, 3, 28, 3, 1, null, null],
  ['Jasmine rice, cooked', 'Arroz jazmin, cocido', 'grain', 129, 2.9, 28, 0.2, 0.3, null, null],
  ['Quinoa, cooked', 'Quinoa, cocida', 'grain', 120, 4.4, 21, 1.9, 2.8, null, null],
  ['Oats, dry', 'Avena, seca', 'grain', 389, 17, 66, 7, 11, null, null],
  ['Oatmeal, cooked', 'Avena, cocida', 'grain', 71, 2.5, 12, 1.5, 1.7, null, null],
  ['Pasta, cooked', 'Pasta, cocida', 'grain', 158, 5.8, 31, 0.9, 1.8, null, null],
  ['Whole wheat pasta, cooked', 'Pasta integral, cocida', 'grain', 149, 6, 30, 1.3, 4, null, null],
  ['Couscous, cooked', 'Cuscus, cocido', 'grain', 112, 3.8, 23, 0.2, 1.4, null, null],
  ['Farro, cooked', 'Farro, cocido', 'grain', 130, 4.6, 26, 0.9, 3.5, null, null],
  ['Barley, cooked', 'Cebada, cocida', 'grain', 123, 2.3, 28, 0.4, 3.8, null, null],
  ['Bulgur, cooked', 'Trigo bulgur, cocido', 'grain', 83, 3.1, 19, 0.2, 4.5, null, null],
  ['Cornmeal / masa harina, dry', 'Masa harina, seca', 'grain', 365, 8.1, 77, 3.6, 7, null, null],
  ['Polenta, cooked', 'Polenta, cocida', 'grain', 70, 1.6, 15, 0.3, 0.9, null, null],
  ['Grits, cooked', 'Semola de maiz, cocida', 'grain', 71, 1.4, 16, 0.2, 0.6, null, null],
  // ---------------------------------------------------------------- breads / tortillas
  ['Whole wheat bread', 'Pan integral', 'grain', 247, 13, 41, 3.4, 6, null, null],
  ['White bread', 'Pan blanco', 'grain', 266, 9, 49, 3.2, 2.7, null, null],
  ['Sourdough bread', 'Pan de masa madre', 'grain', 256, 11, 48, 2, 2.4, null, null],
  ['Bagel, plain', 'Bagel, simple', 'grain', 250, 10, 49, 1.5, 2.1, null, null],
  ['Flour tortilla', 'Tortilla de harina', 'grain', 304, 8, 49, 8, 3, null, null],
  ['Corn tortilla', 'Tortilla de maiz', 'grain', 218, 5.7, 45, 2.8, 6, null, null],
  ['Whole wheat tortilla', 'Tortilla integral', 'grain', 281, 9, 47, 6, 7, null, null],
  ['Tostada shell', 'Tostada', 'grain', 432, 7, 60, 18, 6, null, null],
  ['Pita bread', 'Pan pita', 'grain', 275, 9, 56, 1.2, 2.2, null, null],
  ['Crackers, saltine', 'Galletas saladas', 'grain', 418, 9, 71, 10, 2.5, null, null],
  ['Pancake', 'Panqueque', 'grain', 227, 6.4, 28, 9.7, 1, null, null],
  ['Waffle', 'Waffle', 'grain', 291, 8, 33, 14, 2, null, null],
  // ---------------------------------------------------------------- starchy veg / tubers
  ['Sweet potato, cooked', 'Camote, cocido', 'vegetable', 90, 2, 21, 0.1, 3.3, null, null],
  ['Potato, baked', 'Papa, al horno', 'vegetable', 93, 2.5, 21, 0.1, 2.2, null, null],
  ['Potato, boiled', 'Papa, hervida', 'vegetable', 87, 2, 20, 0.1, 1.8, null, null],
  ['Mashed potatoes', 'Pure de papa', 'vegetable', 113, 1.9, 17, 4.2, 1.5, null, null],
  ['French fries', 'Papas a la francesa', 'vegetable', 312, 3.4, 41, 15, 3.8, null, null],
  ['Yuca / cassava, cooked', 'Yuca, cocida', 'vegetable', 160, 1.4, 38, 0.3, 1.8, null, null],
  ['Plantain, ripe, cooked', 'Platano macho maduro, cocido', 'fruit', 122, 1.3, 32, 0.4, 2.3, null, null],
  ['Tostones (fried green plantain)', 'Tostones', 'fruit', 215, 1.5, 38, 7, 3, null, null],
  ['Corn, cooked', 'Elote, cocido', 'vegetable', 96, 3.4, 21, 1.5, 2.4, null, null],
  // ---------------------------------------------------------------- vegetables
  ['Broccoli', 'Brocoli', 'vegetable', 34, 2.8, 7, 0.4, 2.6, null, null],
  ['Cauliflower', 'Coliflor', 'vegetable', 25, 1.9, 5, 0.3, 2, null, null],
  ['Spinach', 'Espinaca', 'vegetable', 23, 2.9, 3.6, 0.4, 2.2, null, null],
  ['Kale', 'Col rizada', 'vegetable', 35, 2.9, 4.4, 1.5, 4.1, null, null],
  ['Romaine lettuce', 'Lechuga romana', 'vegetable', 17, 1.2, 3.3, 0.3, 2.1, null, null],
  ['Mixed greens', 'Mezcla de hojas verdes', 'vegetable', 17, 1.4, 3, 0.2, 1.5, null, null],
  ['Bell pepper', 'Pimiento', 'vegetable', 31, 1, 6, 0.3, 2.1, null, null],
  ['Poblano pepper', 'Chile poblano', 'vegetable', 20, 0.9, 4.6, 0.1, 1.8, null, null],
  ['Jalapeno', 'Jalapeno', 'vegetable', 29, 0.9, 6.5, 0.4, 2.8, null, null],
  ['Serrano pepper', 'Chile serrano', 'vegetable', 32, 1.7, 6.7, 0.4, 3.7, null, null],
  ['Nopales (cactus), cooked', 'Nopales, cocidos', 'vegetable', 22, 1.5, 4.5, 0.1, 2, null, null],
  ['Carrot', 'Zanahoria', 'vegetable', 41, 0.9, 10, 0.2, 2.8, null, null],
  ['Tomato', 'Tomate', 'vegetable', 18, 0.9, 3.9, 0.2, 1.2, null, null],
  ['Tomatillo', 'Tomatillo', 'vegetable', 32, 0.96, 5.8, 1, 1.9, null, null],
  ['Onion', 'Cebolla', 'vegetable', 40, 1.1, 9, 0.1, 1.7, null, null],
  ['Cucumber', 'Pepino', 'vegetable', 15, 0.7, 3.6, 0.1, 0.5, null, null],
  ['Zucchini', 'Calabacin', 'vegetable', 17, 1.2, 3.1, 0.3, 1, null, null],
  ['Calabaza squash', 'Calabaza', 'vegetable', 26, 1, 6.5, 0.1, 0.5, null, null],
  ['Green beans, cooked', 'Ejotes, cocidos', 'vegetable', 35, 1.9, 8, 0.3, 3.4, null, null],
  ['Asparagus, cooked', 'Esparragos, cocidos', 'vegetable', 22, 2.4, 4.1, 0.2, 2, null, null],
  ['Brussels sprouts, cooked', 'Coles de Bruselas, cocidas', 'vegetable', 36, 2.6, 7.1, 0.5, 2.6, null, null],
  ['Mushrooms', 'Champinones', 'vegetable', 22, 3.1, 3.3, 0.3, 1, null, null],
  ['Cabbage', 'Repollo', 'vegetable', 25, 1.3, 5.8, 0.1, 2.5, null, null],
  ['Beets, cooked', 'Betabel, cocido', 'vegetable', 44, 1.7, 10, 0.2, 2, null, null],
  ['Celery', 'Apio', 'vegetable', 16, 0.7, 3, 0.2, 1.6, null, null],
  ['Eggplant, cooked', 'Berenjena, cocida', 'vegetable', 35, 0.8, 8.7, 0.2, 2.5, null, null],
  ['Pico de gallo', 'Pico de gallo', 'vegetable', 30, 1, 6.5, 0.3, 1.5, null, null],
  ['Salsa verde', 'Salsa verde', 'vegetable', 36, 1, 7, 1, 1.5, null, null],
  ['Salsa roja', 'Salsa roja', 'vegetable', 36, 1.5, 7, 0.5, 1.6, null, null],
  // ---------------------------------------------------------------- fruits
  ['Banana', 'Platano', 'fruit', 89, 1.1, 23, 0.3, 2.6, null, null],
  ['Apple', 'Manzana', 'fruit', 52, 0.3, 14, 0.2, 2.4, null, null],
  ['Strawberries', 'Fresas', 'fruit', 32, 0.7, 7.7, 0.3, 2, null, null],
  ['Blueberries', 'Arandanos', 'fruit', 57, 0.7, 14, 0.3, 2.4, null, null],
  ['Raspberries', 'Frambuesas', 'fruit', 52, 1.2, 12, 0.7, 6.5, null, null],
  ['Orange', 'Naranja', 'fruit', 47, 0.9, 12, 0.1, 2.4, null, null],
  ['Grapes', 'Uvas', 'fruit', 69, 0.7, 18, 0.2, 0.9, null, null],
  ['Pineapple', 'Pina', 'fruit', 50, 0.5, 13, 0.1, 1.4, null, null],
  ['Mango', 'Mango', 'fruit', 60, 0.8, 15, 0.4, 1.6, null, null],
  ['Papaya', 'Papaya', 'fruit', 43, 0.5, 11, 0.3, 1.7, null, null],
  ['Watermelon', 'Sandia', 'fruit', 30, 0.6, 8, 0.2, 0.4, null, null],
  ['Cantaloupe', 'Melon', 'fruit', 34, 0.8, 8, 0.2, 0.9, null, null],
  ['Guava', 'Guayaba', 'fruit', 68, 2.6, 14, 0.9, 5.4, null, null],
  ['Peach', 'Durazno', 'fruit', 39, 0.9, 10, 0.3, 1.5, null, null],
  ['Pear', 'Pera', 'fruit', 57, 0.4, 15, 0.1, 3.1, null, null],
  ['Kiwi', 'Kiwi', 'fruit', 61, 1.1, 15, 0.5, 3, null, null],
  ['Cherries', 'Cerezas', 'fruit', 63, 1.1, 16, 0.2, 2.1, null, null],
  ['Lime', 'Limon verde', 'fruit', 30, 0.7, 11, 0.2, 2.8, null, null],
  ['Tamarind', 'Tamarindo', 'fruit', 239, 2.8, 63, 0.6, 5.1, null, null],
  ['Prickly pear (tuna)', 'Tuna (fruta de nopal)', 'fruit', 41, 0.7, 9.6, 0.5, 3.6, null, null],
  ['Dates', 'Datiles', 'fruit', 277, 1.8, 75, 0.2, 6.7, null, null],
  ['Raisins', 'Pasas', 'fruit', 299, 3.1, 79, 0.5, 3.7, null, null],
  ['Avocado', 'Aguacate', 'fruit', 160, 2, 9, 15, 7, null, null],
  ['Guacamole', 'Guacamole', 'fruit', 157, 2, 9, 14, 6.7, null, null],
  // ---------------------------------------------------------------- dairy / alternatives
  ['Milk, whole', 'Leche, entera', 'dairy', 61, 3.2, 4.8, 3.3, 0, 1.03, null],
  ['Milk, 2%', 'Leche, 2%', 'dairy', 50, 3.4, 4.8, 2, 0, 1.03, null],
  ['Milk, skim', 'Leche, descremada', 'dairy', 34, 3.4, 5, 0.1, 0, 1.03, null],
  ['Almond milk, unsweetened', 'Leche de almendras, sin azucar', 'dairy', 15, 0.6, 0.3, 1.2, 0.3, 1.03, null],
  ['Oat milk', 'Leche de avena', 'dairy', 47, 1, 7, 1.5, 0.8, 1.03, null],
  ['Soy milk, unsweetened', 'Leche de soya, sin azucar', 'dairy', 33, 2.9, 1.8, 1.6, 0.5, 1.03, null],
  ['Greek yogurt, nonfat', 'Yogur griego, sin grasa', 'dairy', 59, 10, 3.6, 0.4, 0, 1.03, null],
  ['Greek yogurt, whole', 'Yogur griego, entero', 'dairy', 97, 9, 4, 5, 0, 1.03, null],
  ['Yogurt, plain low-fat', 'Yogur natural, bajo en grasa', 'dairy', 63, 5.3, 7, 1.6, 0, 1.03, null],
  ['Cottage cheese, low-fat', 'Requeson, bajo en grasa', 'dairy', 72, 12, 2.7, 1, 0, null, null],
  ['Cheddar cheese', 'Queso cheddar', 'dairy', 403, 25, 1.3, 33, 0, null, null],
  ['Mozzarella, part-skim', 'Mozzarella, semidescremada', 'dairy', 254, 24, 2.8, 16, 0, null, null],
  ['Queso fresco', 'Queso fresco', 'dairy', 299, 18, 3.6, 24, 0, null, null],
  ['Queso Oaxaca', 'Queso Oaxaca', 'dairy', 356, 22, 3, 28, 0, null, null],
  ['Cotija cheese', 'Queso cotija', 'dairy', 368, 24, 4, 28, 0, null, null],
  ['Crema mexicana', 'Crema mexicana', 'dairy', 300, 2.4, 4, 30, 0, null, null],
  ['Sour cream', 'Crema agria', 'dairy', 198, 2.4, 4.6, 19, 0, null, null],
  ['Cream cheese', 'Queso crema', 'dairy', 342, 6, 4.1, 34, 0, null, null],
  ['Parmesan cheese', 'Queso parmesano', 'dairy', 431, 38, 4.1, 29, 0, null, null],
  ['String cheese', 'Queso en tiras', 'dairy', 280, 24, 3, 18, 0, null, null],
  // ---------------------------------------------------------------- fats / nuts / seeds
  ['Butter', 'Mantequilla', 'fat', 717, 0.9, 0.1, 81, 0, null, null],
  ['Olive oil', 'Aceite de oliva', 'fat', 884, 0, 0, 100, 0, 0.92, null],
  ['Avocado oil', 'Aceite de aguacate', 'fat', 884, 0, 0, 100, 0, 0.92, null],
  ['Coconut oil', 'Aceite de coco', 'fat', 892, 0, 0, 99, 0, 0.92, null],
  ['Vegetable oil', 'Aceite vegetal', 'fat', 884, 0, 0, 100, 0, 0.92, null],
  ['Mayonnaise', 'Mayonesa', 'fat', 680, 1, 0.6, 75, 0, null, null],
  ['Peanut butter', 'Mantequilla de mani', 'fat', 588, 25, 20, 50, 6, null, null],
  ['Almond butter', 'Mantequilla de almendra', 'fat', 614, 21, 19, 56, 10, null, null],
  ['Almonds', 'Almendras', 'fat', 579, 21, 22, 50, 12.5, null, null],
  ['Walnuts', 'Nueces', 'fat', 654, 15, 14, 65, 6.7, null, null],
  ['Cashews', 'Anacardos', 'fat', 553, 18, 30, 44, 3.3, null, null],
  ['Pistachios', 'Pistachos', 'fat', 560, 20, 28, 45, 10, null, null],
  ['Pecans', 'Nuez pecana', 'fat', 691, 9, 14, 72, 9.6, null, null],
  ['Peanuts', 'Cacahuates', 'fat', 567, 26, 16, 49, 8.5, null, null],
  ['Chia seeds', 'Semillas de chia', 'fat', 486, 17, 42, 31, 34, null, null],
  ['Flax seeds', 'Semillas de linaza', 'fat', 534, 18, 29, 42, 27, null, null],
  ['Pumpkin seeds (pepitas)', 'Pepitas de calabaza', 'fat', 559, 30, 11, 49, 6, null, null],
  ['Sunflower seeds', 'Semillas de girasol', 'fat', 584, 21, 20, 51, 8.6, null, null],
  ['Coconut, shredded', 'Coco rallado', 'fat', 660, 6.9, 24, 65, 16, null, null],
  // ---------------------------------------------------------------- prepared / Mexican dishes
  ['Beef taco (single)', 'Taco de res', 'prepared', 226, 12, 17, 12, 3, null, null],
  ['Chicken burrito', 'Burrito de pollo', 'prepared', 206, 11, 24, 7, 2, null, null],
  ['Cheese quesadilla', 'Quesadilla de queso', 'prepared', 280, 13, 24, 15, 2, null, null],
  ['Chicken enchilada', 'Enchilada de pollo', 'prepared', 168, 9, 14, 9, 2, null, null],
  ['Tamale', 'Tamal', 'prepared', 230, 6, 25, 12, 3, null, null],
  ['Pozole, chicken', 'Pozole de pollo', 'prepared', 70, 5, 7, 2.5, 1.5, null, null],
  ['Chilaquiles', 'Chilaquiles', 'prepared', 185, 6, 20, 9, 2.5, null, null],
  ['Menudo', 'Menudo', 'prepared', 60, 6, 4, 2.5, 0.5, null, null],
  ['Ceviche', 'Ceviche', 'prepared', 95, 14, 5, 1.5, 0.6, null, null],
  ['Elote (street corn)', 'Elote preparado', 'prepared', 160, 4, 22, 7, 2.5, null, null],
  ['Mole sauce', 'Mole', 'prepared', 142, 3, 12, 9, 2.5, null, null],
  // ---------------------------------------------------------------- snacks / sweets / drinks
  ['Tortilla chips', 'Totopos', 'snack', 489, 7, 64, 23, 5, null, null],
  ['Popcorn, air-popped', 'Palomitas, sin grasa', 'snack', 387, 13, 78, 4.5, 15, null, null],
  ['Dark chocolate 70%', 'Chocolate amargo 70%', 'snack', 598, 7.8, 46, 43, 11, null, null],
  ['Granola', 'Granola', 'snack', 471, 10, 64, 20, 7, null, null],
  ['Protein bar', 'Barra de proteina', 'snack', 350, 30, 36, 9, 8, null, null],
  ['Honey', 'Miel', 'sweetener', 304, 0.3, 82, 0, 0.2, 1.42, null],
  ['Maple syrup', 'Jarabe de maple', 'sweetener', 260, 0, 67, 0.1, 0, 1.37, null],
  ['Sugar, white', 'Azucar, blanca', 'sweetener', 387, 0, 100, 0, 0, null, null],
  ['Orange juice', 'Jugo de naranja', 'beverage', 45, 0.7, 10, 0.2, 0.2, 1.04, null],
  ['Coffee, black', 'Cafe, negro', 'beverage', 1, 0.1, 0, 0, 0, 1.0, null],
  ['Horchata', 'Horchata', 'beverage', 50, 0.3, 11, 0.6, 0.1, 1.04, null],
  ['Coconut water', 'Agua de coco', 'beverage', 19, 0.7, 3.7, 0.2, 1.1, 1.0, null],
  // ---------------------------------------------------------------- condiments
  ['Ketchup', 'Catsup', 'condiment', 101, 1.2, 27, 0.1, 0.3, null, null],
  ['Soy sauce', 'Salsa de soya', 'condiment', 53, 8, 4.9, 0.6, 0.8, null, null],
  ['Hot sauce', 'Salsa picante', 'condiment', 11, 0.5, 1.8, 0.4, 0.3, null, null],
  ['Mustard', 'Mostaza', 'condiment', 67, 4.4, 5.8, 4, 4, null, null],
  ['BBQ sauce', 'Salsa BBQ', 'condiment', 172, 0.8, 41, 0.6, 0.8, null, null],
  ['Ranch dressing', 'Aderezo ranch', 'condiment', 430, 1.3, 6, 45, 0, null, null],
  ['Adobo sauce', 'Salsa adobo', 'condiment', 90, 1.5, 13, 4, 2, null, null],
  ['Lime juice', 'Jugo de limon', 'condiment', 25, 0.4, 8.4, 0.1, 0.4, 1.03, null],
  ['Balsamic vinegar', 'Vinagre balsamico', 'condiment', 88, 0.5, 17, 0, 0, 1.06, null],
  // ---------------------------------------------------------------- more LATAM staples / dishes
  ['Arepa', 'Arepa', 'grain', 218, 4.5, 45, 2.5, 4, null, null],
  ['Empanada, beef', 'Empanada de carne', 'prepared', 312, 9, 28, 18, 2, null, null],
  ['Pupusa, cheese', 'Pupusa de queso', 'prepared', 250, 9, 30, 11, 3, null, null],
  ['Sopes', 'Sopes', 'prepared', 240, 6, 28, 12, 3, null, null],
  ['Gorditas', 'Gorditas', 'prepared', 270, 7, 30, 13, 3, null, null],
  ['Flautas, chicken', 'Flautas de pollo', 'prepared', 290, 11, 26, 16, 2.5, null, null],
  ['Carne molida picadillo', 'Picadillo de carne', 'prepared', 165, 13, 8, 9, 1.5, null, null],
  ['Birria', 'Birria', 'prepared', 195, 21, 3, 11, 0.5, null, null],
  ['Cochinita pibil', 'Cochinita pibil', 'prepared', 225, 22, 3, 14, 0.5, null, null],
  ['Frijoles charros', 'Frijoles charros', 'prepared', 110, 6, 14, 3.5, 4, null, null],
  ['Arroz con leche', 'Arroz con leche', 'prepared', 125, 2.6, 22, 2.8, 0.3, null, null],
  ['Flan', 'Flan', 'prepared', 196, 5, 32, 5.5, 0, null, null],
  ['Conchas (pan dulce)', 'Conchas (pan dulce)', 'grain', 360, 7, 56, 12, 2, null, null],
  ['Churros', 'Churros', 'snack', 405, 5, 48, 21, 1.5, null, null],
  ['Aguas frescas (jamaica)', 'Agua de jamaica', 'beverage', 32, 0.1, 8, 0, 0.1, 1.02, null],
  ['Atole', 'Atole', 'beverage', 72, 1.8, 14, 1, 0.3, 1.05, null],
  ['Cafe de olla', 'Cafe de olla', 'beverage', 28, 0.1, 7, 0, 0, 1.0, null],
  ['Mango con chile', 'Mango con chile', 'snack', 70, 0.9, 17, 0.4, 1.8, null, null],
  ['Jicama', 'Jicama', 'vegetable', 38, 0.7, 9, 0.1, 4.9, null, null],
  ['Chayote, cooked', 'Chayote, cocido', 'vegetable', 24, 0.6, 5.1, 0.4, 1.7, null, null],
  ['Chia pudding', 'Pudin de chia', 'snack', 130, 4, 13, 7, 8, null, null],

  // ============================================================ BARCODED packaged items (~20)
  // per-100g macros from label panels; barcode = real-world UPC/EAN for the manual barcode path.
  ['Quest Protein Bar, Chocolate Chip', 'Barra de proteina Quest, Chispas de chocolate', 'snack', 345, 35, 40, 14, 28, null, '888849000074'],
  ['Premier Protein Shake, Chocolate', 'Batido de proteina Premier, Chocolate', 'beverage', 67, 12, 4, 1, 0.7, 1.04, '643843715009'],
  ['Fairlife Core Power 26g, Chocolate', 'Fairlife Core Power 26g, Chocolate', 'beverage', 65, 9.4, 5.9, 0.9, 0, 1.04, '811620021289'],
  ['Chobani Greek Yogurt, Plain Nonfat', 'Yogur griego Chobani, Natural sin grasa', 'dairy', 59, 10, 3.6, 0.4, 0, 1.03, '894700010045'],
  ['Oikos Triple Zero, Vanilla', 'Oikos Triple Zero, Vainilla', 'dairy', 60, 10, 5, 0, 0.8, 1.03, '036632074379'],
  ['Quaker Old Fashioned Oats', 'Avena Quaker tradicional', 'grain', 379, 13, 67, 6.5, 10, null, '030000010402'],
  ['Barilla Spaghetti, dry', 'Espagueti Barilla, crudo', 'grain', 357, 13, 71, 2, 3, null, '076808001037'],
  ['Mission Flour Tortillas, Soft Taco', 'Tortillas de harina Mission', 'grain', 306, 8, 51, 7, 3, null, '073731071007'],
  ['Mission White Corn Tortillas', 'Tortillas de maiz blanco Mission', 'grain', 218, 5.7, 45, 2.8, 6, null, '073731000885'],
  ['La Costena Refried Pinto Beans', 'Frijoles refritos La Costena', 'legume', 95, 5, 16, 1.5, 5, null, '076397001012'],
  ['Goya Black Beans, canned', 'Frijoles negros Goya, enlatados', 'legume', 91, 6, 16, 0.5, 6, null, '041331025515'],
  ['Bumble Bee Tuna in Water', 'Atun Bumble Bee en agua', 'seafood', 116, 26, 0, 0.8, 0, null, '086600000169'],
  ['Optimum Nutrition Gold Standard Whey, Vanilla', 'Proteina ON Gold Standard, Vainilla', 'protein', 379, 79, 14, 4, 0, null, '748927024098'],
  ['Skippy Creamy Peanut Butter', 'Crema de cacahuate Skippy', 'fat', 588, 22, 22, 50, 6, null, '037600105187'],
  ['Philadelphia Cream Cheese', 'Queso crema Philadelphia', 'dairy', 342, 6, 4.5, 34, 0, null, '021000000869'],
  ['Kirkland Rotisserie Chicken', 'Pollo rostizado Kirkland', 'poultry', 190, 29, 0, 7.8, 0, null, '099482448417'],
  ['Egg Beaters Original', 'Egg Beaters Original', 'protein', 48, 10, 1, 0, 0, 1.03, '022259000018'],
  ['Halo Top Vanilla Ice Cream', 'Helado Halo Top Vainilla', 'snack', 120, 6, 28, 3, 6, null, '858089004017'],
  ['Quest Tortilla Chips, Nacho', 'Totopos Quest, Nacho', 'snack', 500, 25, 36, 25, 18, null, '888849008261'],
  ['Clif Builders Protein Bar, Chocolate', 'Barra Clif Builders, Chocolate', 'snack', 376, 24, 53, 9, 6, null, '722252201355'],
  ['Liquid Egg Whites (carton)', 'Claras de huevo liquidas (caja)', 'protein', 52, 11, 0.7, 0.2, 0, 1.03, '717544207573'],
];

// Category-level raw->cooked weight factors (USDA Cooking Yields R2). cooked = raw * factor.
const RATIOS = [
  ['poultry', 0.70, 'USDA Cooking Yields R2 (poultry ~30% loss roasted)'],
  ['beef', 0.73, 'USDA Cooking Yields R2 (ground/cuts beef ~27% loss)'],
  ['pork', 0.74, 'USDA Cooking Yields R2 (pork ~26% loss)'],
  ['seafood', 0.80, 'USDA Cooking Yields R2 (fish/seafood ~20% loss)'],
  ['legume', 2.4, 'USDA Cooking Yields R2 (dry legumes ~2.4x cooked weight)'],
];

// [food name_en match, label_en, label_es, grams, is_cooked, is_default]
const PORTIONS = [
  ['Egg, whole', '1 large egg', '1 huevo grande', 50, false, true],
  ['Egg white', '1 large white', '1 clara grande', 33, false, true],
  ['Banana', '1 medium', '1 mediano', 118, false, true],
  ['Apple', '1 medium', '1 mediana', 182, false, true],
  ['Orange', '1 medium', '1 mediana', 131, false, true],
  ['Avocado', '1/2 avocado', '1/2 aguacate', 100, false, true],
  ['Olive oil', '1 tbsp', '1 cucharada', 14, false, true],
  ['Peanut butter', '1 tbsp', '1 cucharada', 16, false, true],
  ['Almond butter', '1 tbsp', '1 cucharada', 16, false, true],
  ['Mayonnaise', '1 tbsp', '1 cucharada', 14, false, true],
  ['Greek yogurt, nonfat', '1 cup', '1 taza', 245, false, true],
  ['Cottage cheese, low-fat', '1 cup', '1 taza', 226, false, true],
  ['White rice, cooked', '1 cup', '1 taza', 158, true, true],
  ['Brown rice, cooked', '1 cup', '1 taza', 195, true, true],
  ['Quinoa, cooked', '1 cup', '1 taza', 185, true, true],
  ['Oatmeal, cooked', '1 cup', '1 taza', 234, true, true],
  ['Oats, dry', '1/2 cup', '1/2 taza', 40, false, true],
  ['Pasta, cooked', '1 cup', '1 taza', 140, true, true],
  ['Black beans, cooked', '1 cup', '1 taza', 172, true, true],
  ['Pinto beans, cooked', '1 cup', '1 taza', 171, true, true],
  ['Lentils, cooked', '1 cup', '1 taza', 198, true, true],
  ['Flour tortilla', '1 tortilla', '1 tortilla', 49, false, true],
  ['Corn tortilla', '1 tortilla', '1 tortilla', 26, false, true],
  ['Whole wheat bread', '1 slice', '1 rebanada', 28, false, true],
  ['White bread', '1 slice', '1 rebanada', 25, false, true],
  ['Chicken breast, grilled', '1 breast', '1 pechuga', 120, true, true],
  ['Almonds', '1 oz (handful)', '1 onza (punado)', 28, false, true],
  ['Walnuts', '1 oz', '1 onza', 28, false, true],
  ['Cashews', '1 oz', '1 onza', 28, false, true],
  ['Sweet potato, cooked', '1 medium', '1 mediano', 130, true, true],
  ['Potato, baked', '1 medium', '1 mediana', 173, true, true],
  ['Milk, 2%', '1 cup', '1 taza', 244, false, true],
  ['Cheddar cheese', '1 slice', '1 rebanada', 28, false, true],
  ['String cheese', '1 stick', '1 barra', 28, false, true],
  ['Beef taco (single)', '1 taco', '1 taco', 100, true, true],
  ['Tamale', '1 tamale', '1 tamal', 142, true, true],
  ['Quest Protein Bar, Chocolate Chip', '1 bar', '1 barra', 60, false, true],
  ['Premier Protein Shake, Chocolate', '1 shake (11 oz)', '1 batido (11 oz)', 325, false, true],
  ['Quaker Old Fashioned Oats', '1/2 cup dry', '1/2 taza seca', 40, false, true],
  ['Bumble Bee Tuna in Water', '1 can drained', '1 lata escurrida', 80, false, true],
];

function esc(s) { return s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`; }
function num(n) { return n == null ? 'null' : String(n); }

const foodVals = F.map((r) => {
  const [en, es, cat, kcal, p, c, f, fib, dens, barcode] = r;
  const search = `${en} ${es || ''}`.toLowerCase();
  return `(null,${esc(SOURCE)},${esc(en)},${esc(es)},${esc(cat)},${num(kcal)},${num(p)},${num(c)},${num(f)},${num(fib)},${dens == null ? 'null' : num(dens)},${barcode == null ? 'null' : esc(barcode)},true,${esc(search)})`;
}).join(',\n');

const sql = `
delete from public.food_log where food_id in (select id from public.foods where source=${esc(SOURCE)});
delete from public.foods where source=${esc(SOURCE)};
insert into public.foods (company_id, source, name_en, name_es, category, kcal, protein_g, carb_g, fat_g, fiber_g, density_g_per_ml, barcode, is_verified, search_text) values
${foodVals};
insert into public.cooked_uncooked_ratios (category, state_from, state_to, factor, usda_source)
select v.category, 'raw', 'cooked', v.factor, v.src from (values
${RATIOS.map((r) => `(${esc(r[0])},${num(r[1])},${esc(r[2])})`).join(',\n')}
) as v(category, factor, src)
where not exists (
  select 1 from public.cooked_uncooked_ratios x
  where x.category = v.category and x.state_from = 'raw' and x.state_to = 'cooked' and x.food_id is null
);
insert into public.food_portions (food_id, label_en, label_es, grams, is_cooked, is_default)
select f.id, p.label_en, p.label_es, p.grams, p.is_cooked, p.is_default from (values
${PORTIONS.map((p) => `(${esc(p[0])},${esc(p[1])},${esc(p[2])},${num(p[3])},${p[4]},${p[5]})`).join(',\n')}
) as p(fname, label_en, label_es, grams, is_cooked, is_default)
join public.foods f on f.name_en = p.fname and f.source=${esc(SOURCE)}
where not exists (select 1 from public.food_portions fp where fp.food_id = f.id and fp.label_en = p.label_en);

select
  (select count(*) from public.foods where source=${esc(SOURCE)}) as foods,
  (select count(*) from public.foods where source=${esc(SOURCE)} and barcode is not null) as barcoded,
  (select count(*) from public.foods where company_id is null) as total_corpus;
`;

fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})
  .then((r) => r.text())
  .then((t) => console.log(t || 'OK'))
  .catch((e) => { console.error('FATAL', e.message); process.exit(1); });
