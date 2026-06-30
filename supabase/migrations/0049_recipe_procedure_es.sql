-- 0049 PHASE 2 -- Bilingual recipe procedures. Completes recipe bilingual coverage: all 158 recipes had
-- procedure_es = null. Hand-translated the full cooking steps to LATAM Spanish (Mexican-leaning vocabulary;
-- brand and proper dish names kept; temperatures, amounts and step numbering preserved). Idempotent
-- (name_en-keyed). Pairs with 0048 (recipe names) and 0047 (exercise names) for end-to-end EN/ES content.

update public.recipes r set procedure_es = v.es from (values
  ('Apple chocolate lollipops with cottage cheese and milk', '1. Derrite el chocolate blanco en una sartén a fuego bajo o en el microondas.
2. Enjuaga la manzana y las uvas, y rebana la manzana. Inserta los palillos en las rebanadas de manzana.
3. Sumerge las rebanadas de manzana en el chocolate derretido y espolvorea las chispas de chocolate encima. Colócalas sobre una bandeja con papel encerado hasta que el chocolate blanco se endurezca.
4. Vierte el requesón en un tazón y la leche en un vaso.
5. Sirve las paletas de manzana con el requesón, las uvas y el vaso de leche al lado.'),
  ('Asian lettuce wrap with turkey slices', '1. Lava las hojas de lechuga y déjalas escurrir. Enjuaga las zanahorias y la col rizada. Ralla las zanahorias y rebana finamente la col. Parte el aguacate a la mitad y retira el hueso. Con una cuchara, saca la pulpa y córtala en cubos. Corta en cubos las lonchas de pavo.
2. Agrega todo, excepto las hojas de lechuga, en un tazón grande junto con los arándanos y las mandarinas escurridas. Sazona con la salsa de pescado, el jugo de limón y la salsa de soja.
3. Coloca una porción del relleno en el centro de una hoja de lechuga y forma los wraps. El relleno restante se puede comer aparte. ¡Disfruta!'),
  ('Asian shrimp salad with rice noodles', '1. Cocina los fideos de arroz según las instrucciones del paquete.
2. Calienta una sartén a fuego medio y agrega un chorrito de agua. Agrega los camarones y fríelos unos minutos hasta que se pongan rosados y dejen de estar translúcidos. Ten cuidado de no cocerlos de más, ya que pueden quedar chiclosos.
3. Enjuaga y rebana las verduras. Escurre los elotitos.
4. Sirve todo en un tazón y rocía la ensalada con salsa de pescado y aceite de sésamo, y sazona con las especias y hierbas de tu elección.'),
  ('Asian style cabbage and bean sprout salad with chicken', '1. Enjuaga la col y el germinado de soja. Pica la col.
2. Mezcla la mantequilla de maní, el aceite de sésamo, la salsa de soja, el jugo de limón y el ajo en polvo para hacer un aderezo.
3. Agrega todos los ingredientes a un tazón, cubre con el aderezo y ¡disfruta!'),
  ('Avocado toast with cottage cheese and pomegranate seeds ❤️', '1. Tuesta el pan, si lo deseas.
2. Parte el aguacate a la mitad y retira el hueso. Con una cuchara, saca la pulpa y machácala con un tenedor o rebánala.
3. Unta el requesón sobre el pan y cubre con el aguacate y las semillas de granada. Exprime el jugo de limón encima y sazona con sal, pimienta y cualquier otra especia o hierba de tu elección. ¡Disfruta!'),
  ('Bacon Egg & Cheese Breakfast Bagels', '1. Precalienta el horno a 400°F. En un tazón, combina los sustitutos de huevo (Egg Beaters) y el requesón sin grasa (primero licúa el requesón con un poco de agua para suavizarlo) junto con tus sazonadores preferidos como pimienta negra, sal de mar y ajo en polvo. Vierte la mezcla en una bandeja con papel encerado y hornea hasta que cuaje. Mientras tanto, cocina una rebanada de tocino en el microondas según las instrucciones del paquete. Cuando el huevo esté listo, córtalo en porciones individuales y arma el sándwich colocando una porción de huevo horneado, una rebanada de queso y el tocino cocido sobre un bagel delgado.'),
  ('Baked lentil falafel with tzatziki', '1. Para hacer el tzatziki: lava el pepino, córtalo a lo largo y retira el centro con una cuchara. Desecha el centro, ralla el resto del pepino y colócalo en un colador para escurrir el exceso de agua. Agrega el yogur, la mitad del ajo, el pepino escurrido y el aceite. Por último, sazona con sal y pimienta y mezcla bien todos los ingredientes. Deja enfriar el tzatziki en el refrigerador 30 minutos antes de servir.
2. Mientras tanto, pon a hervir una olla con agua y agrega una pizca de sal. Cocina las lentejas según las instrucciones del paquete.
3. Precalienta el horno a 350°F.
4. Pela y pica la cebolla y agrégala a un procesador de alimentos junto con el resto del ajo, el cilantro, el perejil, el jugo de limón, la levadura nutricional y las lentejas cocidas, y procesa hasta formar una mezcla grumosa. Ten cuidado de no procesar de más, ya que la mezcla quedaría demasiado suave.
5. Forma bolitas con la mezcla y colócalas en una bandeja con papel encerado. Hornea de 25 a 30 minutos hasta que el exterior esté dorado y crujiente y el centro esté caliente.
6. Enjuaga la espinaca y colócala en un plato con las bolitas de falafel y el tzatziki al lado.'),
  ('Baked vegetables and salmon with lemon', '1. Precalienta el horno a 400°F (convencional) o 350°F (con ventilador).
2. Enjuaga y talla los camotes bajo agua fría (o pélalos si prefieres), luego córtalos en cubos. Enjuaga y corta en cubos el calabacín.
3. Coloca dos trozos grandes de papel aluminio uno sobre otro. Pon las verduras en el centro del aluminio y coloca el salmón encima. Sazona con sal y pimienta.
4. Coloca las rebanadas de limón sobre el salmón y termina con el aceite. Cierra el aluminio y hornea unos 30 minutos o hasta que el centro del pescado esté opaco y se desmenuce fácilmente y las verduras estén suaves.
5. Sirve el salmón con las verduras en un plato.'),
  ('Banana and almond butter smoothie', '1. Pela y rebana el plátano. Agrega todos los ingredientes a la licuadora. Licúa unos 30 segundos, o hasta obtener una consistencia uniforme y cremosa. Agrega un poco de agua o cubos de hielo para lograr la textura deseada, si es necesario, y licúa de nuevo.
2. Sirve el batido en un vaso.'),
  ('Banana and Biscoff overnight oats', 'Nota: Esta receta debe prepararse la noche anterior y guardarse en el refrigerador por al menos 4 horas.
1. Pela y agrega el plátano a un tazón. Machácalo con la mitad del sirope de arce y todo el yogur griego.
2. Agrega la avena y la proteína en polvo con la leche de almendras y la mezcla de yogur a un tazón y revuelve bien.
3. Derrite la crema de Biscoff en el microondas, luego incorpora el resto del sirope de arce y el yogur natural. Cubre la avena con la crema de Biscoff. Tapa y refrigera toda la noche, o por al menos 4 horas, para que la avena se hidrate.
4. ¡Sirve y disfruta!'),
  ('Banana and Nutella French toast', '1. Mezcla las claras de huevo con la proteína en polvo hasta que quede suave.
2. Deja remojar el pan en la mezcla de claras hasta que esté bien empapado. Calienta una sartén antiadherente a fuego medio-alto y fríe el pan hasta que se dore por ambos lados.
3. Derrite la Nutella y el chocolate blanco en el microondas en dos tazones separados. Pela y rebana el plátano y agrégalo a la tostada francesa. Rocía con el chocolate y la Nutella y sirve.'),
  ('Banana muffins with chocolate chunks', '1. Precalienta el horno a 400°F (convencional) o 350°F (con ventilador).
2. Pela y machaca el plátano, luego bátelo junto con los huevos.
3. Mezcla la avena, el chocolate picado, las pasas, la proteína en polvo, el polvo para hornear y una pizca de sal y endulzante si lo deseas. Incorpora la mezcla seca a la de plátano y huevos y mezcla hasta integrar bien. Agrega un poco de agua si la masa está muy espesa.
4. Engrasa o forra el molde para muffins y llena cada cavidad con masa hasta unas 3/4 partes.
5. Hornea unos 12 a 18 minutos. Asegúrate de colocarlos en la rejilla central del horno.
6. Deja enfriar los muffins de 5 a 10 minutos antes de servir.'),
  ('Banana pancakes with Greek yogurt, blueberries, and syrup', '1. Pela el plátano y córtalo en trozos pequeños. Enjuaga los arándanos.
2. Agrega el plátano, los huevos y la avena a la licuadora. Licúa unos 30 segundos o hasta obtener una consistencia uniforme y cremosa. Agrega un poco de agua para lograr la textura deseada si es necesario y licúa de nuevo.
3. Calienta una sartén a fuego medio-alto con el aceite y agrega 2-3 cucharadas de masa para freír hasta que se formen pequeñas burbujas en la superficie. Asegúrate de distribuir la masa de manera uniforme sobre la base de la sartén sin dejar huecos en cuanto la viertas. Voltea el panqueque y fríe hasta que se dore por ambos lados. Repite el proceso con el resto de la masa.
4. Sirve los panqueques calientes cubiertos con el yogur, los arándanos y el sirope.'),
  ('Banana protein pancakes with maple syrup', '1. Pela el plátano y córtalo en trozos pequeños.
2. Agrega los huevos, el plátano, el yogur, la proteína en polvo y el polvo para hornear a la licuadora. Licúa todos los ingredientes hasta integrar todo y obtener una masa espesa. Agrega un poco de agua si la masa está muy espesa.
3. Calienta una sartén a fuego alto con el aceite de coco y agrega aproximadamente 2 cucharadas de masa por panqueque para crear panqueques pequeños y gruesos. Fríelos a fuego medio unos minutos hasta que aparezcan pequeñas burbujas en la superficie. Voltea el panqueque y cocina del otro lado unos minutos hasta que comience a dorarse. Repite el proceso con el resto de la masa.
4. Sirve los panqueques con el sirope.'),
  ('Banana, coconut oil and skyr protein smoothie', '1. Pela el plátano. Agrega todos los ingredientes y un poco de agua a la licuadora. Licúa unos 30 segundos, o hasta obtener una consistencia uniforme y cremosa. Agrega más agua o cubos de hielo para lograr la textura deseada, si es necesario, y licúa de nuevo.
2. Sirve el batido en un vaso y ¡disfruta!'),
  ('Barebell protein', '1. Abre y disfruta.'),
  ('Barebell protein bar', '1. Abre y disfruta.'),
  ('Birria Tacos', '1. Cocina la birria siguiendo las instrucciones del paquete. Toma 4 tortillas de cero carbohidratos netos y remójalas en el caldo de birria. Coloca las tortillas en una sartén a fuego medio-alto, volteándolas hasta que estén crujientes. Distribuye uniformemente 227 gramos (1 taza) o 1/2 paquete de carne de birria en cada tortilla. Guarda la otra mitad para la próxima vez.
2. Enjuaga y seca 28 gramos (1/4 taza) de queso mozzarella rallado sin grasa. Agrega un poco de queso a cada taco.
3. Dobla las tortillas a la mitad y voltéalas en la sartén hasta que el queso se derrita.
4. Cúbrelos con un poco de cebolla picada y cilantro.'),
  ('Biscoff French toast', '1. Mezcla las claras de huevo con la proteína en polvo hasta que quede suave. Agrega un poco de agua si la mezcla está muy espesa.
2. Deja remojar el pan en la mezcla de claras hasta que esté bien cubierto. Calienta una sartén antiadherente a fuego medio-alto y fríe el pan hasta que se dore por ambos lados.
3. Derrite la crema de Biscoff en el microondas y tritura las galletas. Rocía la tostada francesa con el Biscoff y espolvorea las galletas encima.'),
  ('Black bean enchiladas with chicken', '1. Precalienta el horno a 350°F.
2. Vierte 1/4 de la salsa para enchiladas en el fondo de un molde para hornear. Ralla el queso y escurre los frijoles. Aparta 1/4 del queso para cubrir. Corta el pollo en cubos.
3. Calienta las tortillas en una sartén caliente con aceite en aerosol a fuego medio-alto unos segundos hasta que se doren por cada lado.
4. Sazona los frijoles con sal y pimienta, y las especias de tu elección. Rellena cada tortilla con queso rallado, pollo y frijoles (divídelos uniformemente entre las tortillas), luego enróllalas firmemente y colócalas con la unión hacia abajo en el molde. Repite hasta que se acaben las tortillas.
5. Vierte el resto de la salsa para enchiladas sobre las tortillas enrolladas y cubre con el resto del queso.
6. Hornea de 20 a 25 minutos o hasta que el queso esté derretido y dorado y la salsa burbujee.
7. Deja enfriar las enchiladas de 5 a 10 minutos, luego sirve con crema agria encima.'),
  ('Blueberry and peanut butter smoothie', '1. Agrega todos los ingredientes a la licuadora. Licúa unos 30 segundos o hasta obtener una consistencia uniforme y cremosa. Agrega un poco de agua o cubos de hielo para lograr la textura deseada si es necesario.
2. Sirve el batido en un vaso.'),
  ('Breakfast tacos with eggs, tomatoes and cottage cheese', '1. Bate los huevos con un poco de sal y pimienta, luego viértelos en una sartén antiadherente y revuelve constantemente a fuego medio-alto hasta que cuajen y no quede huevo líquido visible.
2. Mientras tanto, enjuaga y parte los tomates a la mitad.
3. Calienta las tortillas según las instrucciones del paquete.
4. Coloca las tortillas extendidas en un plato y cúbrelas con el huevo y los tomates. Come el requesón aparte o mézclalo con los huevos mientras se cocinan.'),
  ('Broccoli and zucchini stir fry', '1. Enjuaga el arroz antes de cocinarlo. Agrégalo a una olla con agua ligeramente salada y cocínalo según las instrucciones del paquete.
2. Mientras tanto, enjuaga las verduras. Corta en cubos el calabacín y el pimiento, y pica el brócoli en trozos pequeños.
3. Fríe las verduras en una sartén con un chorrito de agua a fuego alto.
4. Bate los huevos y luego agrégalos, junto con el arroz, a la sartén. Fríe unos minutos más revolviendo de vez en cuando.
5. Sazona con sal, pimienta y chile en polvo. ¡Sirve y disfruta!'),
  ('Bulgur salad with boiled chicken and pomegranate', '1. Pon a hervir una olla con agua y agrega una pizca de sal y el caldo de pollo. Agrega el pollo y hiérvelo de 20 a 25 minutos. Puedes añadir unas rebanadas de limón o las hierbas de tu elección para dar más sabor. Cuando el pollo esté listo, escúrrelo y córtalo en trozos pequeños.
2. Mientras tanto, cocina el bulgur según las instrucciones del paquete en una olla con agua ligeramente salada.
3. Enjuaga el germinado de soja y la arúgula. Parte el aguacate a la mitad y retira el hueso. Con una cuchara, saca la pulpa y córtala en cubos.
4. Mezcla el bulgur, el pollo, la granada, la arúgula, el germinado de soja y el aguacate en una ensalada. Cubre con el aceite de oliva, sal, pimienta y jugo de limón.'),
  ('Butter chicken', '1. Comienza marinando el pollo. Primero, agrega el comino molido, el pimentón, el jugo de limón y el yogur a un tazón. Corta el pollo en trozos pequeños y agrégalo al tazón con el yogur. Marina el pollo durante 15 minutos.
2. Mientras el pollo se marina, pela y pica la cebolla. Calienta el aceite en una cacerola grande y agrega la cebolla, el ajo, el chile y el jengibre; fríe durante 10 minutos a fuego medio.
3. Luego, agrega la pasta de tomate y el garam masala y fríe 2 minutos. Después agrega el caldo.
4. Agrega el contenido del pollo marinado a la sartén y cocina de 15 a 20 minutos o hasta que el pollo esté cocido y la salsa haya espesado.
5. Mientras tanto, enjuaga el arroz antes de cocinarlo. Agrégalo a una olla con agua ligeramente salada y cocínalo según las instrucciones del paquete.
6. Sirve el butter chicken con el arroz.'),
  ('Caesar salad', '1. Fríe el pollo en una sartén a fuego medio-alto hasta que ya no esté rosado en el centro. Después rebana la pechuga.
2. Enjuaga y rebana la lechuga y corta en cubos los tomates. Pela y pica la cebolla.
3. Prepara el aderezo mezclando las yemas, el aceite de oliva, la mostaza, el vinagre y un poco de agua si es necesario. Sazona con sal y pimienta.
4. Mezcla todos los ingredientes en un tazón y cubre con parmesano rallado.'),
  ('Cajun style chicken with rice', '1. Enjuaga los champiñones para quitar el exceso de tierra y rebánalos.
2. Cocina el arroz según las instrucciones del paquete en una olla con agua ligeramente salada.
3. Fríe el pollo en una sartén con el aceite a fuego medio-alto hasta que esté dorado y bien cocido, pero no seco. Después rebana la pechuga a lo largo y regrésala a la sartén.
4. Agrega los tomates en cubos, los champiñones, el ajo y la mezcla de especias cajún a la sartén y deja cocer a fuego lento 10 minutos. Sazona con sal y pimienta al gusto.
5. Sirve el arroz y el pollo, vierte la salsa del pollo sobre el platillo y espolvorea el queso parmesano encima. Sirve caliente.'),
  ('Carrot muffins', '1. Precalienta el horno a 350°F.
2. Mezcla la harina, la harina de almendras, la mitad del endulzante, la vainilla, la canela, el jengibre y el polvo para hornear.
3. Ralla las zanahorias y mézclalas con la ralladura de limón y el aceite de coco derretido. Agrega a los ingredientes secos y mezcla para integrar.
4. En otro tazón, bate las claras de huevo con el resto del endulzante hasta que estén firmes.
5. Incorpora suavemente las claras al resto de los ingredientes y vierte la masa en un molde para muffins forrado.
6. Hornea los muffins unos 8 a 12 minutos.
7. Sácalos del horno, déjalos enfriar y sírvelos con una cucharada de yogur.'),
  ('Chia overnight oats', 'Nota: El pudín de chía debe reposar en el refrigerador por al menos 15 minutos o toda la noche antes de servir.
1. Bate las semillas de chía con la leche y la avena en un tazón. Cubre el tazón con plástico y déjalo en el refrigerador para que se hidrate al menos 15 minutos.
2. Enjuaga las frutas. Cubre el pudín de chía con el yogur y los arándanos antes de servir. Si queda leche, bébela aparte.'),
  ('Chia power smoothie', '1. Pela y rebana el plátano y el kiwi. Agrega todos los ingredientes a la licuadora. Licúa unos 30 segundos, o hasta obtener una consistencia uniforme y cremosa. Agrega un poco de agua o cubos de hielo para lograr la textura deseada, si es necesario, y licúa de nuevo.
2. Sirve el batido en un vaso.'),
  ('Chicken and bacon burger', '1. Sazona el pollo con sal y pimienta. Fríe el pollo por ambos lados en una sartén con un chorrito de agua a fuego medio-alto durante unos 10 minutos, hasta que el centro ya no esté rosado.
2. Fríe el tocino en la sartén hasta que esté crujiente.
3. Tuesta el pan de hamburguesa si lo deseas. Enjuaga las hojas de lechuga.
4. Unta la cátsup y la mayonesa en los panes y agrega el pollo, el tocino y la lechuga. ¡Disfruta!'),
  ('Chicken and banana curry', '1. Enjuaga los chícharos chinos. Pela y pica el plátano. Pica las almendras.
2. Corta el pollo en trozos pequeños y sazona con sal y pimienta.
3. En una sartén a fuego medio, cocina el pollo con la salsa madras durante 3 minutos. Agrega la leche de coco y el agua y baja el fuego. Deja cocer a fuego lento 5 minutos.
4. Pon a hervir una olla con agua. Agrega los chícharos chinos y cocina de 3 a 4 minutos, luego escúrrelos con un colador.
5. Agrega el plátano a la sartén con el pollo y cocina un minuto más.
6. Sirve el curry con los chícharos chinos y decora con las almendras. ¡Disfruta!'),
  ('Chicken and vegetable curry with rice', '1. Enjuaga el arroz antes de cocinarlo. Agrégalo a una olla con agua ligeramente salada y cocínalo según las instrucciones del paquete.
2. Sazona el pollo con sal y pimienta y córtalo en trozos pequeños. Fríe el pollo en una sartén engrasada con aceite en aerosol a fuego medio-alto durante unos 5 a 7 minutos, hasta que el centro ya no esté rosado.
3. Lava y pica las verduras, luego cocínalas con la leche de coco y el curry en polvo en una sartén a fuego medio durante 10 minutos.
4. Acomoda todo en un plato. Sazona con sal, pimienta y albahaca fresca al gusto.'),
  ('Chicken Caesar Lettuce Wraps', '1. Coloca una sartén mediana en la estufa a fuego medio.
2. Sazona los filetes de pollo con sal, pimienta, ajo en polvo, cebolla en polvo y pimentón (no escatimes en el sazón).
3. Coloca los filetes sazonados en la sartén y cocina 5 minutos por cada lado (tapa los filetes durante los 10 minutos completos).
4. Cuando los filetes estén bien cocidos (la temperatura interna alcance los 165°F), pica el pollo en trozos pequeños. Entre más pequeños los trozos, mejor la textura en mi opinión.
5. En un tazón grande, agrega el pollo picado, el aderezo César, el queso y las cebollas, y mezcla bien.
6. Coloca tres hojas de lechuga apiladas una sobre otra y rellénalas con 1/4 de la mezcla de pollo. Dobla cada lado de la hoja de lechuga y enróllala como un burrito.
7. ¡Disfruta!
8. Para preparación de comidas (meal prep):
9. Separa la mezcla de pollo en 4 recipientes, y cuando estés listo para comer, sigue el último paso de las instrucciones anteriores.'),
  ('Chicken carbonara with mushrooms', '1. Enjuaga y rebana los champiñones. Agrégalos a una sartén a fuego medio y fríelos 5 minutos hasta que estén dorados. Apártalos.
2. Cocina la pasta según las instrucciones del paquete en una olla con agua ligeramente salada.
3. Sazona el pollo con sal y pimienta y córtalo en trozos pequeños. Fríe el pollo en la misma sartén con un chorrito de agua a fuego medio-alto durante unos 5 a 7 minutos, hasta que el centro ya no esté rosado.
4. Mezcla la yema de huevo, el queso y la leche en un tazón y bate hasta integrar todo. Sazona con sal y pimienta.
5. Regresa la pasta a la olla (con el fuego apagado) y combínala con la mezcla de yema, los champiñones y el pollo.
6. Sirve en un plato y ¡disfruta!'),
  ('Chicken teriyaki with broccoli', '1. Enjuaga las verduras y luego pícalas en trozos pequeños. Escurre el elote.
2. Corta el pollo en tiras y mézclalo con la salsa teriyaki. Fríe el pollo en una sartén a fuego medio-alto hasta que esté dorado, luego agrega el brócoli y el pimiento y cocina otros 3 a 5 minutos o hasta que el pollo esté bien cocido, pero no seco, y las verduras estén ligeramente tiernas. Sazona con sal y pimienta al gusto.
3. Agrega el elote y la mantequilla de maní y mezcla hasta que se calienten.
4. Sirve el pollo teriyaki con las verduras y ¡disfruta!'),
  ('Chickpea and spinach shakshuka', '1. Precalienta el horno a 375°F (convencional) o 350°F (con ventilador).
2. Pela y pica la cebolla y enjuaga la espinaca. Escurre los garbanzos.
3. Calienta una sartén a fuego bajo-medio y cocina el ajo y la cebolla con un chorrito de agua hasta que estén tiernos y aromáticos.
4. Incorpora los tomates en cubos, la espinaca, las especias, la sal y la pimienta. Deja cocer a fuego medio 5 minutos antes de agregar los garbanzos y cocinar 5 minutos más.
5. Con una espátula, forma pequeños huecos para colocar los huevos. Rompe los huevos uniformemente encima.
6. Mete la sartén al horno y hornea hasta que los huevos cuajen, unos 8 a 10 minutos. Cubre con el requesón y sirve con el pan.'),
  ('Chili sin carne with chickpeas', '1. Pela y pica las cebollas.
2. Fríe las cebollas y el ajo en una olla con el aceite a fuego medio, hasta que se ablanden.
3. Agrega las hojuelas de chile, el comino, la canela y los tomates en cubos, y sazona con sal y pimienta. Deja cocer a fuego lento unos 5 minutos.
4. Escurre los garbanzos y agrégalos a la olla. Deja cocer el chili tapado durante 10 minutos. Agrega un poco de caldo si es necesario.
5. Tuesta el pan si lo deseas. Sirve el chili sin carne en un tazón y come el pan aparte. ¡Disfruta!'),
  ('Chili tomato and shrimp pasta', '1. Calienta una sartén seca a fuego alto. Enjuaga y pica los tomates. Agrega los tomates picados, luego tapa y cocina 10 minutos. Destapa la sartén y agrega el aceite, el ajo, el chile y el vinagre. Sazona con sal, pimienta y una pizca de azúcar, luego deja cocer a fuego lento 5 minutos o hasta que la salsa espese.
2. Destapa la sartén, luego agrega los camarones a la salsa de tomate y cocina hasta que apenas estén rosados. Ten cuidado de no cocerlos de más, ya que pueden quedar chiclosos.
3. Mientras tanto, cocina la pasta según las instrucciones del paquete. Escurre la pasta, luego agrégala a la sartén con un buen chorro del agua de cocción. Agrega el perejil picado a la sartén y revuelve para integrar, luego sirve.'),
  ('Chocolate and hazelnut yogurt bowl', '1. Agrega la proteína en polvo al yogur. Mezcla bien para evitar grumos.
2. Pica grueso o ralla el chocolate.
3. Cubre el yogur con la mantequilla de avellana y el chocolate.'),
  ('Chocolate hazelnut raw date balls', '1. Agrega todos los ingredientes a un procesador de alimentos y procesa hasta que alcancen una consistencia pegajosa. Agrega un poco de agua si la mezcla está muy seca.
2. Forma bolitas con la mezcla. Si es posible, refrigéralas al menos 30 minutos antes de servir.'),
  ('Chocolate muffins', '1. Precalienta el horno a 400°F (convencional) o 350°F (con ventilador).
2. Pela y machaca el plátano, luego bátelo junto con los huevos y el yogur.
3. Mezcla la avena, el cacao en polvo, el polvo para hornear y una pizca de sal y endulzante si lo deseas. Incorpora la mezcla seca a la de plátano y huevos y mezcla hasta integrar bien. Agrega un poco de agua si la masa está muy espesa.
4. Engrasa o forra el molde para muffins y llena cada cavidad con masa hasta unas 3/4 partes.
5. Hornea unos 12 a 18 minutos. Asegúrate de colocarlos en el centro del horno.
6. Deja enfriar los muffins de 5 a 10 minutos antes de servir.'),
  ('Chunky Monkey Yogurt Bowl', '1. En un tazón, sirve el yogur griego y cubre con chispas de chocolate Lily''s, plátano rebanado y granola. Mezcla el PBFit con endulzante sin calorías y un chorrito de agua para lograr una consistencia un poco más ligera que la mantequilla de maní, luego rocíalo sobre tu tazón.'),
  ('Classic pasta Bolognese', '1. Cocina la pasta según las instrucciones del paquete en una olla con agua ligeramente salada.
2. Mientras tanto, fríe la carne molida en una sartén con el aceite a fuego medio-alto hasta que se dore por completo. Agrega los tomates enlatados y sazona con sal, pimienta y cualquier otra hierba o especia de tu elección. Deja cocer la salsa a fuego lento unos 10 a 15 minutos.
3. Sirve la pasta con la salsa.'),
  ('Cocoa and peanut butter muffins', '1. Precalienta el horno a 400°F (convencional) o 350°F (con ventilador).
2. Pica finamente el chocolate.
3. En un tazón, bate las claras de huevo hasta que estén firmes, luego agrega suavemente la fécula de papa y la mitad del endulzante.
4. En otro tazón, mezcla la harina de almendras, el polvo para hornear, el cacao en polvo, la mantequilla de maní, el chocolate y el resto del endulzante. Incorpora suavemente las claras a la mezcla.
5. Vierte la masa en moldes para muffins o un molde forrado y hornea de 20 a 25 minutos o hasta que se doren.
6. Deja enfriar y sirve.'),
  ('Coconut curry soup with chicken', '1. Enjuaga y pica la coliflor y el calabacín.
2. Fríe el pollo por todos lados en una sartén a fuego medio-alto hasta que ya no esté rosado en el centro. Después rebana el pollo, si lo deseas.
3. Fríe el ajo con el curry en polvo en una olla a fuego medio-alto durante unos 3 a 4 minutos. Agrega la coliflor y el calabacín. Vierte la leche de coco y un poco de agua (si es necesario) y pon a hervir. Una vez que hierva, baja el fuego y deja cocer a fuego lento unos 5 a 10 minutos o hasta que las verduras estén cocidas. Sazona con sal y pimienta.
4. Sirve la sopa con las rebanadas de pollo.'),
  ('Coconut rice with tilapia', '1. Enjuaga el arroz antes de cocinarlo. Calienta una olla a fuego alto con el aceite en aerosol, luego agrega el arroz, la leche de coco y una pizca de sal. Hierve el arroz hasta que la leche de coco baje en la superficie y el arroz quede visible, luego baja el fuego, tapa y deja cocer a fuego lento unos 15 minutos. Retira del fuego y deja reposar otros 5 minutos.
2. Sazona el pescado con sal y pimienta. Coloca la tilapia en una sartén a fuego medio con un chorrito de agua y saltea por ambos lados unos minutos, o hasta que se desmenuce fácilmente con un tenedor.
3. Parte el aguacate a la mitad y retira el hueso. Con una cuchara, saca la pulpa y rebánala.
4. Sirve el arroz y el pescado en un plato. Cubre el arroz con las rebanadas de aguacate y jugo de limón.'),
  ('Coconut shrimp', '1. Mezcla la harina de coco con las hojuelas de coco en un tazón. Agrega las claras de huevo a un tazón aparte y sazona con ajo en polvo y pimienta negra.
2. Sumerge cada camarón en las claras y cúbrelo con las hojuelas de coco.
3. Calienta una sartén a fuego medio y agrega el aceite. Agrega los camarones y fríelos unos minutos hasta que se pongan rosados y dejen de estar translúcidos. Ten cuidado de no cocerlos de más, ya que pueden quedar chiclosos.
4. Enjuaga la lechuga y la cebollita de cambray. Rebana la cebollita.
5. Sirve los camarones al coco con la lechuga y la cebollita y ¡disfruta!'),
  ('Cottage cheese pasta with parmesan', '1. Agrega el requesón, la leche, la fécula de maíz, el ajo en polvo y un poco de sal y pimienta a una licuadora o procesador de alimentos. Licúa unos 30 segundos o hasta que quede suave.
2. Vierte la salsa en una sartén y lleva a un hervor suave. Sigue cocinando hasta que tenga la consistencia de una crema para verter.
3. Cocina la pasta según las instrucciones del paquete en una olla con agua ligeramente salada.
4. Agrega la pasta a la salsa con el parmesano, revuelve bien y sirve con un poco de perejil encima.'),
  ('Crispy chicken with soy sauce', '1. Precalienta el horno a 400°F (convencional) o 350°F (con ventilador).
2. Corta el pollo en trozos pequeños.
3. Usando 2 tazones pequeños, agrega la harina de coco en uno y la miel en el otro. Primero cubre el pollo con la miel, luego pasa los trozos por la harina. Asegúrate de cubrir todos los lados.
4. Derrite el aceite de coco en el microondas o en una olla en la estufa. Coloca el pollo en una bandeja forrada y rocíalo con el aceite. Hornea de 12 a 15 minutos o hasta que estén dorados y crujientes.
5. Sirve el pollo con la salsa de soja al lado como dip.'),
  ('Curry and chili fried rice with chicken', '1. Enjuaga el arroz antes de cocinarlo. Agrégalo a una olla con agua ligeramente salada y cocínalo según las instrucciones del paquete.
2. Enjuaga y corta en cubos los pimientos, y pela y pica las cebollitas de cambray.
3. Sazona el pollo con sal y pimienta y córtalo en trozos pequeños. Fríe el pollo en una sartén con la mitad del aceite a fuego medio-alto durante unos 5 a 7 minutos, hasta que el centro ya no esté rosado.
4. Agrega los pimientos en cubos y las cebollitas y fríe unos minutos.
5. Retira el pollo y las verduras de la sartén y agrega el resto del aceite. Fríe ligeramente el arroz y agrega el curry y el chile en polvo.
6. Cuando el arroz esté frito, regresa el pollo y las verduras a la sartén, revuelve y sirve.'),
  ('Easy homemade falafel', '1. Pela y pica la cebolla. Escurre y enjuaga los garbanzos.
2. Agrega la cebolla, los garbanzos, el perejil, el cilantro, el chile, el ajo, el comino, la sal y la pimienta negra a un procesador de alimentos y procesa hasta formar una mezcla grumosa. Ten cuidado de no procesar de más, ya que la mezcla quedaría demasiado húmeda.
3. Pasa la mezcla de falafel a un tazón y agrega la harina de garbanzo y el bicarbonato. Revuelve, luego tapa y refrigera la mezcla de 30 minutos a una hora.
4. Forma bolitas con la mezcla hasta usar toda la masa.
5. Calienta una sartén con el aceite a fuego alto y fríe las bolitas de falafel hasta que estén doradas y crujientes por fuera y calientes en el centro, unos 15 minutos. Tal vez necesites voltearlas continuamente para evitar que se quemen.
6. Enjuaga y rebana la espinaca y el pepino. Sirve con las bolitas de falafel y el yogur y ¡disfruta!'),
  ('Edamame salad with tomatoes and cucumber', '1. Enjuaga los tomates y el pepino, luego córtalos en cubos. Enjuaga el germinado de soja, luego pela la cebolla y pícala finamente.
2. Pon a hervir una olla con agua. Agrega los frijoles de edamame y cocina solo 2 minutos, luego escúrrelos con un colador.
3. Mezcla todas las verduras y los arándanos en un tazón.
4. Cubre la ensalada con el requesón y el perejil y rocía el aceite de oliva encima. Sazona con sal y pimienta y ¡disfruta!'),
  ('Egg fried rice with green beans', '1. Enjuaga el arroz antes de cocinarlo. Agrégalo a una olla con agua ligeramente salada y cocínalo según las instrucciones del paquete.
2. Pon a hervir una olla con agua y agrega una pizca de sal. Agrega los ejotes a la olla y cocínalos durante unos 4 a 7 minutos, o hasta que puedas atravesarlos con un tenedor.
3. Rompe los huevos en un tazón pequeño y bátelos con un poco de sal y pimienta.
4. Luego, calienta una sartén antiadherente a fuego medio-alto y fríe el ajo durante 1 minuto. Después, agrega el arroz cocido y fríe hasta que se dore un poco. Agrega los huevos e incorpora el resto de los ingredientes. Sazona con salsa hoisin o sal y pimienta o cualquier otra hierba o especia de tu elección.
5. Cocina todo junto en la sartén hasta que los huevos cuajen y no quede huevo líquido visible, luego cubre con las semillas de sésamo.'),
  ('Egg muffins with spinach and ham', '1. Precalienta el horno a 400°F (convencional) o 350°F (con ventilador).
2. Enjuaga la espinaca. Pela y pica finamente la cebolla. Corta el pavo en trozos pequeños.
3. Rompe los huevos en un tazón y bátelos con las claras de huevo. Agrega las cebollas, el pavo y la espinaca, así como los sazonadores de tu elección.
4. Coloca los capacillos en el molde para muffins. Vierte la mezcla en las cavidades y hornea de 20 a 30 minutos o hasta que estén dorados y firmes.
5. Sirve los muffins con el pan al lado.'),
  ('Egg noodles with chicken and stir-fried vegetables', '1. Cocina los fideos según las instrucciones del paquete en una olla con agua ligeramente salada.
2. Sazona el pollo con sal y pimienta y córtalo en trozos pequeños. Fríe el pollo en una sartén con el aceite a fuego medio-alto durante unos 5 a 7 minutos, hasta que el centro ya no esté rosado.
3. Enjuaga las verduras. Rebana el pimiento y rebana finamente la cebollita de cambray.
4. Fríe las verduras en la salsa hoisin de 4 a 5 minutos a fuego alto.
5. Mezcla todo y sirve.'),
  ('English muffin with egg and ham', '1. Calienta una sartén antiadherente a fuego medio. Rompe los huevos en la sartén, sazona con sal y pimienta y cocina 3 minutos o hasta que la clara cuaje. También puedes freír los huevos por cada lado de 1 a 2 minutos.
2. Parte el muffin a la mitad y tuéstalo si lo deseas.
3. Cubre el muffin con el huevo y las rebanadas de jamón y sirve.'),
  ('Fairlife Chocolate Protein Shake', '1. Abre y disfruta.'),
  ('Fast homemade raspberry ice cream', '1. Agrega las frambuesas congeladas, el yogur y la miel a una licuadora o procesador de alimentos. Mezcla unos 30 segundos hasta obtener un helado con consistencia suave.
2. Lava las frambuesas frescas.
3. Sirve el helado casero en un tazón. Cubre con frambuesas, almendras y coco y disfruta el helado de inmediato. También puedes comerlo frío metiéndolo al congelador para más tarde.'),
  ('Fattoush (Lebanese pita and vegetable salad)', '1. Bate el jugo de limón, el ajo, el zumaque, el jarabe de granada, la menta seca y sal y pimienta. Agrega poco a poco la mitad del aceite de oliva, batiendo constantemente hasta emulsionar. Aparta.
2. Corta el pan pita en triángulos. Calienta el resto del aceite en una sartén a fuego medio, luego agrega los trozos de pan pita y sal y pimienta. Cocina hasta que estén crujientes, revolviendo con frecuencia.
3. Enjuaga y pica la lechuga, los tomates, los pepinos, los pimientos, los rábanos y las cebollitas de cambray. Agrega todas las verduras a un tazón y mezcla con el perejil. Rocía con el aderezo y mezcla de nuevo.
4. Agrega los triángulos de pan pita y las semillas de granada a la ensalada y sirve. ¡Disfruta!'),
  ('Fiber One Chocolate Fudge Brownie', '1. ¡Abre y disfruta!'),
  ('Foul Mudammas - Egyptian Breakfast 🌱', '1. Enjuaga y rebana finamente el pepino y la cebollita de cambray a lo largo. Enjuaga el tomate y córtalo en cubos.
2. Mezcla el jugo de limón, el ajo y el aceite de oliva en un tazón. Escurre los frijoles y enjuágalos con agua fría en un colador.
3. Calienta una cacerola a fuego medio-alto y agrega los frijoles. Agrega un poco de sal, pimienta y comino. Revuelve bien los frijoles hasta que empiecen a soltar vapor. No deben freírse.
4. Mezcla la proteína en polvo con la cantidad de agua sugerida en el paquete. (Siempre puedes agregar más agua o cubos de hielo para ajustar la consistencia a tu gusto). Vierte el batido de proteína en un vaso.
5. Coloca los frijoles en un plato hondo y cubre con el perejil, las verduras y el aderezo de limón. Sirve con el pan y el batido de proteína al lado.'),
  ('Fruit salad ', '1. Pela el plátano, enjuaga las uvas, las fresas y los arándanos. Rebana el plátano y corta en cubos el resto de la fruta. Mezcla todo en un tazón.'),
  ('Fruit smoothie', '1. Pela el plátano. Agrega todos los ingredientes y un poco de agua a la licuadora. Licúa unos 30 segundos, o hasta obtener una consistencia uniforme y cremosa. Agrega más agua o cubos de hielo para lograr la textura deseada, si es necesario, y licúa de nuevo.
2. Sirve el batido en un vaso.'),
  ('Ginger and chili Asian bowl with spicy tofu 🌱', '1. Descongela el mango.
2. Corta el tofu en cubos y mézclalo con las hojuelas de chile y la salsa de soja en un tazón.
3. Calienta una sartén antiadherente a fuego medio y rocía con aceite en aerosol. Agrega el tofu a la sartén y cocina hasta que se caliente.
4. Pon a hervir una olla pequeña con agua. Agrega los frijoles de edamame y cocina solo 2 minutos, luego escúrrelos con un colador.
5. Enjuaga el calabacín y retira las puntas. Usa un espiralizador para hacer las tiras de "pasta". Si no tienes espiralizador, corta el calabacín a lo largo en tiras de aproximadamente 1/2 pulgada de grosor y usa un pelapapas para crear tiras largas. Coloca la "pasta" en un tazón, cúbrela con agua hervida y déjala aproximadamente 1 minuto para que se cocine, luego escurre.
6. Mezcla los frijoles de edamame, el mango, el cilantro, el chile, el jugo de limón y el jengibre en un tazón. Agrega los fideos de calabacín y el tofu y ¡disfruta!'),
  ('Greek Pasta Salad', '1. Cocina 224 gramos (~2 1/4 tazas) de pasta rotini de garbanzo según las instrucciones de la caja. Una vez cocida la pasta, escúrrela y enjuágala.
2. Sazona 448 gramos (~3 tazas) de filetes de pechuga de pollo con un poco de ajo en polvo, cebolla en polvo, sal, pimienta y pimentón, y cocínalos en una sartén tapada a fuego medio 6 minutos por cada lado (o hasta que el pollo alcance una temperatura interna de 165°F). Pica la pechuga cocida en trozos pequeños.
3. Agrega la pasta a un tazón grande junto con el pollo, 300 gramos (2 tazas) de pepino en cubos, 100 gramos (2/3 taza) de cebolla morada en cubos, 100 gramos (1/2 taza) de tomates cherry en cubos, 168 gramos (1 1/2 tazas) de queso feta sin grasa y 248 gramos (1/2 botella) de
4. vinagreta griega...
5. y mezcla tu ensalada ;)'),
  ('Ground beef and rice with broccoli and carrots', '1. Cocina el arroz según las instrucciones del paquete en una olla con agua ligeramente salada.
2. Enjuaga y corta el brócoli y las zanahorias en trozos pequeños. Pela y pica la cebolla.
3. Calienta una sartén a fuego medio-alto con un chorrito de agua y fríe la cebolla hasta que esté translúcida. Agrega la carne molida, el brócoli y las zanahorias y revuelve hasta que la carne se dore por completo y esté bien cocida. Sazona con sal, pimienta y cualquier otra hierba o especia de tu elección.
4. Sirve el arroz con la carne y las verduras.'),
  ('Ground beef, green beans and rice with avocado', '1. Cocina el arroz según las instrucciones del paquete en una olla con agua ligeramente salada.
2. Fríe la carne molida con un chorrito de agua en una sartén a fuego medio-alto hasta que se dore por completo. Sazona con sal, pimienta o cualquier otra hierba o especia de tu elección.
3. Pon a hervir una olla con agua y agrega una pizca de sal. Agrega los ejotes a la olla y cocínalos durante unos 3 minutos o hasta que puedas atravesarlos con un tenedor.
4. Parte el aguacate a la mitad y retira el hueso. Con una cuchara, saca la pulpa y rebánala.
5. Sirve el arroz, la carne y los ejotes con el aguacate. Sazona con sal, pimienta o cualquier otra hierba o especia de tu elección.'),
  ('Halo Top peanut butter ice cream ', '1. Abre y disfruta.'),
  ('Halo Top peanut butter ice cream with waffle cone', '1. Tritura las almendras.
2. Sirve el helado en un tazón.
3. Sirve de inmediato.'),
  ('Harissa chicken', '1. Coloca la pechuga de pollo entre dos hojas de papel toalla y golpéala con un rodillo para lograr un grosor uniforme y asegurar que el pollo se cocine de manera pareja. Luego, coloca el pollo en una bolsa con cierre junto con el jugo de limón, 2/3 del sazonador de harissa y el aceite de oliva. Deja marinar en el refrigerador toda la noche o por al menos 1 hora antes de cocinar.
2. Precalienta el horno a 400°F (convencional) o 350°F (con ventilador).
3. Escurre y enjuaga los garbanzos y colócalos en una bandeja forrada, sazona con el resto del sazonador de harissa y cocínalos en el horno durante unos 15 minutos.
4. Mientras tanto, cocina el arroz según las instrucciones del paquete en una olla con agua ligeramente salada.
5. Calienta una sartén y fríe el pollo a fuego alto unos minutos por cada lado hasta que esté dorado y sellado. Luego envuélvelo en papel aluminio y colócalo en el horno para cocinar de 20 a 25 minutos. Desenvuelve el pollo inmediatamente después de cocinar y déjalo reposar 5 minutos para que quede jugoso.
6. Mezcla el yogur griego, el jugo de limón, el ajo, el cilantro, la sal y la pimienta en un dip. Enjuaga y pica el pepino.
7. Sirve el arroz junto con el pollo, los garbanzos asados, el dip y el pepino.'),
  ('Hashbrowns with eggs and bacon', '1. Pela las papas y luego rállalas en un tazón con agua. Escurre las papas, sécalas con un paño y déjalas secar al aire en una bandeja de 5 a 10 minutos.
2. Mientras tanto, enjuaga la espinaca y la naranja y corta la naranja en gajos.
3. Calienta una sartén con la mantequilla a fuego medio-alto y extiende las papas ralladas para que cubran toda la sartén. Tapa y cocina unos 5 a 7 minutos o hasta que la parte de abajo de las papas esté crujiente y dorada, luego voltéalas sobre un plato para que el lado crujiente quede arriba. Sazona con sal y pimienta.
4. En un lado de la sartén, fríe el tocino con un chorrito de agua a fuego medio-alto hasta que esté dorado y crujiente. Bate los huevos y la espinaca con un poco de sal y pimienta, luego viértelos en el otro lado de la sartén y revuelve constantemente a fuego medio-alto hasta que cuajen y no quede huevo líquido visible. Sazona con sal y pimienta al gusto.
5. Sirve las papas ralladas con el tocino, las claras de huevo y la espinaca, y come la naranja al lado.'),
  ('Healthy cookies with oats and dried cranberries', '1. Precalienta el horno a 400°F (convencional) o 350°F (con ventilador).
2. Mezcla la avena, el Sukrin, los arándanos secos, el polvo para hornear y la proteína en polvo en un tazón.
3. Agrega la clara de huevo y el aceite de coco y mezcla bien la masa de las galletas.
4. Divide la masa en bolitas del mismo tamaño y colócalas en una bandeja con papel para hornear.
5. Hornea las galletas unos 5 a 10 minutos hasta que estén ligeramente doradas.
6. Deja enfriar las galletas y sirve.'),
  ('Homemade caramel popcorn', '1. Calienta la mitad del aceite de coco en una olla grande y agrega los granos de palomitas. Tapa y deja a fuego medio-alto. Cuando los granos empiecen a reventar, baja el fuego. Agita la olla mientras revientan y luego retira la olla del fuego cuando dejen de reventar.
2. Calienta el resto del aceite de coco en otra olla y agrega el sirope de arce. Déjalo caramelizar 2 minutos a fuego medio-bajo (ten cuidado de que no se queme), luego retíralo de la estufa e incorpora la vainilla. Rocía sobre las palomitas y revuelve para cubrir, luego espolvorea con sal.
3. Extiende las palomitas en una bandeja forrada formando una capa uniforme y deja enfriar. Mezcla la proteína en polvo con la cantidad de agua sugerida en el paquete.
4. Disfruta las palomitas con el batido de proteína al lado.'),
  ('Honey garlic wings with dill yogurt dip', '1. Precalienta el horno a 450°F.
2. Combina la miel, el aceite, la salsa de soja y el diente de ajo en un tazón. Mezcla el pollo con la salsa y deja reposar mientras preparas los demás ingredientes.
3. Mezcla el yogur con el eneldo, el queso azul, la cebolla en polvo, el ajo en polvo y sal y pimienta. Enjuaga y corta el apio en bastones.
4. Coloca las alitas en una bandeja forrada y hornéalas de 15 a 20 minutos, hasta que el pollo ya no esté rosado en el centro. Voltea las alitas de vez en cuando para que se cocinen de manera uniforme.
5. Sirve las alitas con los bastones de apio y el dip de yogur. ¡Disfruta!'),
  ('Honeydew peach smoothie bowl with puffed quinoa', '1. Retira el hueso del durazno, luego córtalo en rebanadas y aparta. Quita la cáscara del melón y córtalo en cubos.
2. Agrega el plátano congelado, el tofu, 2/3 de los duraznos, la cúrcuma y el melón a una licuadora o procesador de alimentos. Licúa unos 30 segundos, o hasta que quede suave. Tal vez necesites agregar un chorrito de agua para una consistencia más ligera.
3. Vierte el batido en un tazón y decóralo con la quinoa inflada, las hojuelas de coco, las semillas de chía y las rebanadas de durazno restantes. ¡Disfruta!'),
  ('In-n-Out Animal Style Fries Dupe', '1. Para hacer la salsa: agrega a un tazón 85 gramos (6 cucharadas) de yogur griego natural sin grasa, 8 gramos (~1/2 cucharada) de vinagre blanco, 51 gramos (~3 cucharadas) de cátsup sin azúcar, 15 gramos (1 cucharada) de relish dulce sin azúcar añadida y 4 gramos (~3/4 cucharadita) de mostaza amarilla, y mezcla todo.
2. Fríe al aire 1 1/2 porciones (~48 piezas) de papas a la francesa delgadas a 400°F durante 13 minutos o hasta que estén crujientes. Mientras se fríen las papas, pica 10 gramos (~3 cucharadas) de cebolla blanca y cocínala en una sartén con un poco de aceite de oliva, a fuego medio, hasta que se dore.
3. Coloca las papas en un tazón y agrega 2 rebanadas de queso encima. Termina con la salsa y las cebollas doradas.
4. Calienta las papas en el microondas unos 20 segundos para recalentar.'),
  ('Jamaican soursop smoothie', '1. Agrega todos los ingredientes a la licuadora. Licúa unos 30 segundos, o hasta obtener una consistencia uniforme y cremosa. Agrega un poco de agua o cubos de hielo para lograr la textura deseada, si es necesario, y licúa de nuevo.
2. Sirve el batido en un vaso.'),
  ('Jimmy Dean breakfast sandwich', '1. Prepara el sándwich de desayuno según las instrucciones del paquete. ¡Disfruta!'),
  ('Lemon and chili tilapia with patatas bravas', '1. Precalienta el horno a 350°F (con ventilador). Enjuaga o pela las papas, luego córtalas en cubos. Colócalas en una bandeja forrada y rocíalas con el aceite. Asegúrate de que las papas queden bien cubiertas. Sazona al gusto con sal y pimienta y agrega el romero. Cocínalas en el horno durante unos 30 a 40 minutos según su tamaño o hasta que estén suaves.
2. Para hacer la salsa de tomate, agrega los tomates en cubos a una olla con el pimentón ahumado. Deja cocer a fuego lento de 10 a 15 minutos.
3. Justo antes de que las papas estén listas, calienta una sartén a fuego medio. Agrega la tilapia, la sal, el chile y el jugo de limón y fríela unos minutos hasta que el pescado se torne opaco y se desmenuce fácilmente.
4. Sirve la salsa de tomate sobre las papas, cubre con el perejil y sirve con la tilapia.'),
  ('Lemon and parsley cauliflower tabbouleh with pan-fried halloumi', '1. Enjuaga la coliflor y córtala en floretes pequeños. Luego, ralla la coliflor (también puedes usar un procesador de alimentos aquí). Coloca el arroz de coliflor en un tazón, cúbrelo con el agua hervida y déjalo reposar unos 4 a 5 minutos. También puedes freír el arroz de coliflor en una sartén hasta que se ablande.
2. Enjuaga y pica finamente el tomate, el pepino, la cebolla y el perejil.
3. Rebana el halloumi y fríelo en una sartén hasta que esté dorado.
4. Mezcla el arroz de coliflor con el tomate, el pepino, la cebolla, el perejil, el aceite de oliva y el jugo de limón.
5. Sazona con sal y pimienta y sirve el tabulé de coliflor junto con el halloumi.'),
  ('Low carb shrimp and grits with kale', '1. Agrega partes iguales de harina de almendras y agua a una sartén a fuego medio y pon a hervir. Incorpora la mantequilla de coco y un poco de sal y baja el fuego. Deja cocer hasta que espese, revolviendo de vez en cuando. Agrega más agua si la mezcla queda muy espesa.
2. Mientras tanto, enjuaga y pica la col rizada. Enjuaga y corta en cubos los tomates, y pica la cebolla.
3. Calienta una sartén a fuego medio y agrega un chorrito de agua, junto con la col rizada, la cebolla y el ajo. Fríe hasta que la col empiece a marchitarse, luego agrega los camarones y fríelos unos minutos hasta que se pongan rosados y dejen de estar translúcidos. Ten cuidado de no cocerlos de más, ya que pueden quedar chiclosos. Sazona con la especia cajún y sal y pimienta.
4. Enjuaga y corta los ejotes en trozos uniformes. Agrega aproximadamente 1/2 a 1 pulgada de agua a una olla e inserta una vaporera o colador. Pon el agua a hervir a fuego alto, luego agrega las verduras a la vaporera y tapa la olla. Deja cocer las verduras al vapor de 5 a 7 minutos o hasta que puedas atravesarlas fácilmente con un tenedor. Deja enfriar, luego mezcla en un tazón con los tomates y sal y pimienta.
5. Cuando la sémola esté lista, cubre con los camarones cajún y la col rizada. Sirve con la ensalada de ejotes al lado.'),
  ('Magic spoon protein cereal ', '1. Vierte el cereal en un tazón, agrega leche sin grasa Fairlife y mezcla con el plátano.
2. ¡Disfruta!'),
  ('Manakish with homemade labneh', 'Nota: el labneh debe prepararse con 4 horas de anticipación, y preferiblemente toda la noche.
1. Coloca un colador sobre un tazón y forra el colador con una manta de cielo. Vierte el yogur en el colador y déjalo escurrir toda la noche en el refrigerador, o por al menos 4 horas. Precalienta el horno a 400°F.
2. En un tazón pequeño, mezcla todas las especias, junto con las semillas de sésamo y el aceite de oliva.
3. Unta la mezcla de especias sobre la pita y colócala en el horno de 5 a 10 minutos, hasta que se caliente.
4. Una vez listo, retira el yogur escurrido del colador y colócalo en un tazón. Incorpora un poco de sal. Enjuaga y corta en cuartos los tomates cherry.
5. Sirve la pita de manakish rociada con la miel. Disfruta con el labneh y los tomates al lado.'),
  ('Matcha breakfast bowl', '1. En un tazón, mezcla bien el yogur y el polvo de matcha.
2. Pela y rebana el plátano. Acomoda las rebanadas sobre el yogur de matcha.
3. Cubre con la mantequilla de almendras antes de servir.'),
  ('McDonalds Apple Pie Dupe', '1. Corta 1 pan plano de lavash en 3 piezas.
2. Pica y distribuye uniformemente 255 gramos (1 taza) de relleno de pay de manzana sin azúcar añadida en cada rebanada de pan.
3. Enrolla las 3 rebanadas de pan en pays (consulta el enlace de abajo para ayuda sobre cómo enrollar el pan en pays) y haz 5 cortes pequeños en cada pay. Barniza los pays con 2 cucharadas de clara de huevo y cubre con 2 a 4 gramos (1/2 a 1 cucharadita) de endulzante moreno sin calorías.
4. Fríe al aire los pays a 390°F durante 4 a 6 minutos.'),
  ('Mediterranean quinoa salad with feta', '1. Cocina la quinoa según las instrucciones del paquete.
2. Enjuaga las verduras y córtalas en trozos. Pela y pica la cebolla. Parte las aceitunas a la mitad. Desmorona el feta.
3. Pon a hervir una olla con agua. Agrega el edamame y cocina 2 minutos, luego escúrrelo con un colador.
4. Bate el aceite de oliva, el vinagre de vino tinto, el orégano y un poco de sal y pimienta para el aderezo.
5. Coloca el pepino, el pimiento, el edamame, la cebolla morada, los tomates, el feta, las aceitunas y el perejil en un tazón grande. Agrega la quinoa y mezcla hasta integrar todo.
6. Vierte el aderezo sobre la ensalada y revuelve para integrar.'),
  ('Meva moodie (Bengali puffed rice and nut snack)', '1. Derrite el ghee en una cacerola a fuego medio, luego agrega el azúcar y la miel y baja el fuego. Revuelve con frecuencia mientras el azúcar se derrite.
2. Una vez disuelto el azúcar, agrega las nueces y el arroz integral y revuelve bien para cubrir antes de retirar del fuego.
3. Sirve con el yogur al lado o sobre el yogur. ¡Disfruta!'),
  ('Mini raspberry cheesecake', '1. Para hacer la base, agrega las nueces a una licuadora y procesa hasta obtener una textura como de migas. Coloca las nueces procesadas en un tazón con la mantequilla, la mitad del endulzante, la harina de almendras y la canela. Mezcla bien para integrar todos los ingredientes.
2. En otro tazón agrega el queso crema, el extracto de vainilla y el resto del endulzante. Bátelos hasta obtener una consistencia suave.
3. Coloca la base de migas en un vaso, asegurándote de presionarla en el fondo, y cubre con la mezcla de queso crema.
4. Enjuaga las frambuesas y colócalas encima del cheesecake. Deja reposar en el congelador 30 minutos antes de servir.'),
  ('Mocha overnight oats', 'Nota: Esta receta debe prepararse la noche anterior y guardarse en el refrigerador por al menos 4 horas.
1. Agrega la avena con todos los demás ingredientes a un tazón y revuelve bien. Tapa y refrigera toda la noche, o por al menos 4 horas, para que la avena se hidrate. ¡Disfruta!'),
  ('Oat protein shake with dark chocolate', '1. Agrega la avena, la proteína en polvo, la harina de coco y el agua a la licuadora. Licúa unos 30 segundos o hasta obtener una consistencia uniforme y cremosa. Agrega un poco de agua o cubos de hielo para lograr la textura deseada.
2. Come el chocolate al lado.'),
  ('Oreo overnight oats', '1. Nota: Ten en cuenta que esta receta debe prepararse la noche anterior y guardarse en el refrigerador por al menos 4 horas.
2. Agrega la avena, las semillas de chía y la proteína en polvo a un tazón o un frasco (lo que yo uso).
3. Agrega la leche (puedes usar leche de almendras pero no tendrá la misma cantidad de proteína).
4. Mezcla, luego tritura las galletas Oreo, refrigera y ¡disfruta!'),
  ('Pan fried shrimp with rice and bell pepper', '1. Cocina el arroz según las instrucciones del paquete en una olla con agua ligeramente salada.
2. Enjuaga y rebana el pimiento.
3. Fríe los camarones y el pimiento unos minutos con el aceite en una sartén a fuego medio-alto. Sazona con sal y pimienta. Cocina hasta que los camarones se pongan rosados y dejen de estar translúcidos. Ten cuidado de no cocerlos de más, ya que pueden quedar chiclosos.
4. Sirve los camarones y el pimiento con el arroz.'),
  ('Pan-fried chicken with brown rice', '1. Enjuaga el arroz antes de cocinarlo. Agrégalo a una olla con agua ligeramente salada y cocínalo según las instrucciones del paquete.
2. Sazona el pollo con sal y pimienta y córtalo en trozos pequeños. Fríe el pollo en una sartén con el aceite a fuego medio-alto durante unos 5 a 7 minutos, hasta que el centro ya no esté rosado.
3. Sirve el pollo y el arroz en un plato. Cubre con diversas especias de tu elección, si lo deseas.'),
  ('Papaya and banana smoothie', '1. Pela la papaya y retira las semillas con una cuchara pequeña. Pela el plátano y córtalo en trozos medianos.
2. Agrega todos los ingredientes a la licuadora. Licúa unos 30 segundos, o hasta obtener una consistencia uniforme y cremosa. Agrega un poco de agua o cubos de hielo para lograr la textura deseada, si es necesario, y licúa de nuevo.
3. Sirve el batido en un vaso.'),
  ('Pasta salad with chicken and veggies', '1. Pon a hervir una olla con agua y agrega una pizca de sal. Cocina la pasta según las instrucciones del paquete. Déjala enfriar después.
2. Enjuaga la espinaca y corta en cubos el pimiento rojo. Parte el aguacate a la mitad y retira el hueso. Con una cuchara, saca la pulpa y rebánala.
3. Mezcla la pasta, el aguacate, el pimiento rojo, la espinaca y el pollo en un tazón y sazona con sal, pimienta y otras especias de tu elección.'),
  ('Pasta with meat sauce', '1. Pon a hervir una olla con agua y agrega una pizca de sal. Cocina la pasta/espagueti según las instrucciones del paquete.
2. Pela y pica finamente la cebolla, pela y ralla la zanahoria, y enjuaga y corta el pimiento en trozos pequeños.
3. Calienta una olla con el aceite a fuego medio-alto y fríe la carne molida y la cebolla hasta que la carne se dore por completo.
4. Cuando la carne esté dorada, agrega el pimiento y la zanahoria a la olla. Fríe otros 5 minutos.
5. Luego agrega los tomates en cubos y un poco de agua y deja que los ingredientes se cuezan en la salsa unos 10 minutos.
6. Sazona con sal, pimienta, chile en polvo, orégano y otras especias a tu gusto. Sirve la pasta con la salsa y ¡disfruta!'),
  ('Pasta with pan-fried chicken', '1. Cocina la pasta según las instrucciones del paquete en una olla con agua ligeramente salada.
2. Sazona el pollo con sal y pimienta y córtalo en trozos pequeños. Fríe el pollo en una sartén con el aceite a fuego medio-alto durante unos 5 a 7 minutos, hasta que el centro ya no esté rosado.
3. Una vez que el pollo y la pasta estén listos, mézclalos. Cubre con el perejil, rocía el jugo de limón sobre el platillo, sazona con sal y pimienta y sirve.'),
  ('Pasta with shrimp and avocado', '1. Cocina la pasta según las instrucciones del paquete en una olla con agua ligeramente salada.
2. Mientras tanto, parte el aguacate a la mitad y retira el hueso. Con una cuchara, saca la pulpa y rebánala. Enjuaga los tomates y córtalos en cubos. Escurre los camarones.
3. Cuando la pasta esté cocida, escúrrela con un colador y colócala en un tazón. Agrega los camarones, el aguacate y el tomate, mezclando todo.
4. Para hacer el aderezo, combina el jugo de limón, la sal y la pimienta, luego rocíalo sobre la pasta.'),
  ('Peanut butter cookies', '1. Precalienta el horno a 350°F.
2. Mezcla todos los ingredientes en un tazón.
3. Con una cuchara, forma galletas pequeñas con la masa y colócalas en una bandeja forrada. Agrega agua si la mezcla está muy espesa.
4. Hornea de 10 a 15 minutos o hasta que estén ligeramente doradas (el centro debe quedar suave).
5. Deja enfriar un poco al menos 5 minutos y luego retíralas de la bandeja y déjalas enfriar sobre una rejilla.'),
  ('Peppermint French toast', '1. Rompe los huevos en un tazón poco profundo y bátelos con una pizca de sal, la leche y el extracto de vainilla. Sumerge el pan en la mezcla de huevo y déjalo remojar 5 minutos.
2. Calienta una sartén antiadherente a fuego medio y fríe el pan por ambos lados hasta que el huevo cuaje y esté dorado. Agrega el resto de la mezcla de huevo a la sartén y cocina hasta que no quede huevo líquido.
3. Tritura los bastones de dulce y coloca el yogur en un tazón. Agrega los bastones de dulce, el extracto de menta y el sirope de chocolate y revuelve hasta integrar bien.
4. Cubre la tostada francesa con la mezcla de yogur y disfruta con los huevos revueltos restantes al lado.'),
  ('Pilau chickpeas with pita bread', '1. Precalienta el horno a 400°F (convencional) o 350°F (con ventilador). Escurre, enjuaga y seca los garbanzos, luego colócalos en una bandeja forrada. Cubre los garbanzos con el sazonador pilau, así como sal y pimienta. Incorpora el sazonador a los garbanzos y hornea 10 minutos.
2. Enjuaga y pica el brócoli en trozos grandes y agrégalo a otra bandeja forrada. Sazona con sal y pimienta. Hornea de 7 a 10 minutos.
3. Mientras tanto, enjuaga y rebana finamente la lechuga, el pepino y los tomates. Parte el aguacate a la mitad y retira el hueso. Con una cuchara, saca la pulpa y rebánala.
4. Prepara un plato con la lechuga, el pepino, el aguacate, el hummus, las aceitunas y los tomates. Agrega los garbanzos y el brócoli cocidos al plato y disfruta con pan pita al lado.'),
  ('Pork banh mi', '1. Para hacer la marinada, coloca todo el ajo prensado y la mitad de la sriracha, el vinagre de arroz, la salsa de pescado y el azúcar moreno en un tazón grande. Agrega el cerdo y mezcla. Marina por al menos 45 minutos, más tiempo si es posible.
2. Enjuaga las zanahorias y el pepino. Ralla las zanahorias y rebana el pepino.
3. Luego coloca el resto del vinagre de arroz, la salsa de pescado y el azúcar moreno en otro tazón grande. Agrega las verduras y revuelve para cubrirlas bien en la marinada. Tapa y refrigera por al menos 30 minutos.
4. Coloca la mayonesa en un tazón pequeño y mezcla con la salsa hoisin, el ajo en polvo y el resto de la sriracha. Aparta (en el refrigerador si es necesario) hasta el momento de usar.
5. Cuando termine de marinar, calienta una sartén a fuego medio-alto con el aceite en aerosol. Agrega la carne y fríe por cada lado de 4 a 5 minutos, o hasta que esté ligeramente rosada en el centro. Retira de la sartén y deja reposar 3 minutos.
6. Mientras el cerdo reposa, corta la baguette a la mitad a lo largo. Tuesta la baguette si lo prefieres. Escurre las verduras. Luego rebana finamente el lomo de cerdo.
7. Para armar el banh mi, primero unta la mayonesa de manera uniforme dentro del pan. Luego agrega las verduras y la carne. Sazona con sal, pimienta y un chorrito de limón al gusto y ¡disfruta!'),
  ('Premier protein shake', '1. Abre y disfruta.'),
  ('Protein cereal & toast with cream cheese', '1. Vierte el cereal en un tazón.
2. Agrega arándanos y un poco más de 1 taza de leche sin grasa Fairlife.
3. Tuesta 2 rebanadas de pan.
4. Agrega queso crema.
5. ¡Disfruta!'),
  ('Protein pancakes with blueberries', '1. Agrega el plátano, las claras de huevo, la proteína en polvo y un poco de agua a una licuadora y procesa 30 segundos o hasta obtener la consistencia de tu elección. Agrega más agua si la masa está muy espesa.
2. Calienta una sartén a fuego medio-alto con el aceite y agrega 2-3 cucharadas de masa para freír hasta que se formen pequeñas burbujas en la superficie. Asegúrate de distribuir la masa de manera uniforme sobre la base de la sartén sin dejar huecos en cuanto la viertas. Voltea el panqueque y fríe hasta que se dore por ambos lados. Repite el proceso con el resto de la masa.
3. Enjuaga los arándanos y colócalos sobre los panqueques y sirve.'),
  ('Protein polenta bowl with pear', '1. Enjuaga los arándanos y la pera. Corta la pera en trozos pequeños. Pica el chocolate.
2. Agrega la harina de maíz y los trozos de pera a una olla. Agrega el agua y bate bien, luego lleva lentamente a hervor a fuego medio. Retira del fuego y deja reposar unos 10 minutos.
3. Agrega el yogur, la proteína en polvo y la canela y revuelve bien para evitar grumos.
4. Sirve el tazón de polenta con los arándanos, la mantequilla de almendras y el chocolate.'),
  ('Protein shake ', '1. Mezcla la proteína en polvo con agua, leche de almendras sin azúcar o leche sin grasa. Si la licúas con hielo, obtendrás una consistencia más espesa.'),
  ('Protein smoothie with banana and coconut', '1. Pela el plátano. Agrega todos los ingredientes con leche a la licuadora. Licúa unos 30 segundos, o hasta obtener una consistencia uniforme y cremosa; agregar hielo la hará más espesa, lo cual recomiendo.
2. Sirve el batido en un vaso.'),
  ('Protein smoothie with strawberries and banana', '1. Agrega todos los ingredientes y un poco de agua a la licuadora. Licúa unos 30 segundos, o hasta obtener una consistencia uniforme y cremosa. Agrega un poco de agua o cubos de hielo para lograr la textura deseada, si es necesario, y licúa de nuevo.
2. Sirve el batido en un vaso.'),
  ('Quinoa taboulé with pan-fried chicken breast fillet', '1. Sazona el pollo con sal y pimienta. Fríe el pollo por ambos lados en una sartén con un chorrito de agua a fuego medio-alto durante unos 10 minutos, hasta que el centro ya no esté rosado.
2. Enjuaga la quinoa antes de cocinarla. Agrégala a una olla con agua y el cubo de caldo y cocínala según las instrucciones del paquete. Déjala enfriar después.
3. Enjuaga el pepino, los pimientos y los tomates y córtalos en trozos pequeños. Escurre los garbanzos.
4. Mezcla la quinoa, los garbanzos, las verduras, el aceite de oliva y el vinagre en un tazón. Sazona con sal y pimienta.
5. Sirve el tabulé de quinoa con la pechuga de pollo.'),
  ('Raspberry, coconut and banana smoothie with protein powder', '1. Pela el plátano.
2. Agrega todos los ingredientes y leche a la licuadora. Licúa unos 30 segundos, o hasta obtener una consistencia uniforme y cremosa.
3. Sirve el batido en un vaso.'),
  ('Roasted sweet potato and broccoli with zesty lemon tuna salad', '1. Precalienta el horno a 400°F (convencional) o 350°F (con ventilador). Enjuaga y talla los camotes bajo agua fría (o pélalos si prefieres), luego córtalos en cubos. Enjuaga y pica el brócoli. Coloca los camotes en una bandeja forrada. Agrega el aceite, sal, pimienta y otras especias/hierbas de tu elección. Cocínalos en el horno durante unos 30 a 40 minutos según su tamaño. Agrega el brócoli durante los últimos 20 minutos de cocción.
2. Escurre el atún y mézclalo en un tazón con el eneldo y el jugo de limón.
3. Sirve el atún con los camotes y el brócoli. ¡Disfruta!'),
  ('RX bar', '1. Abre y disfruta.'),
  ('Scrambled eggs, turkey bacon, toast and raspberries', '1. Fríe el tocino de pavo en una sartén con un chorrito de agua a fuego medio-alto hasta que esté dorado y crujiente. Enjuaga las frutas.
2. Bate las claras de huevo con un poco de sal y pimienta, luego viértelas en una sartén antiadherente y revuelve constantemente a fuego medio-alto hasta que cuajen y no quede huevo líquido visible.
3. Tuesta el pan y sirve junto con las claras de huevo revueltas, el tocino y las rebanadas de pollo. Come las frambuesas al lado.'),
  ('Shrimp and pea fried rice with egg', '1. Cocina el arroz según las instrucciones del paquete en una olla con agua ligeramente salada.
2. Calienta una sartén con el aceite a fuego medio y cocina el arroz y los chícharos juntos. Una vez que el arroz se ablande y los chícharos se descongelen, agrega los camarones y cocina hasta que se calienten. Retira todo de la sartén y colócalo en un tazón.
3. Calienta una sartén a fuego medio. Rompe los huevos en la sartén y cocina 3 minutos, o hasta que la clara cuaje. También puedes voltear los huevos para cocinar la yema por ambos lados; para esto, fríe los huevos por cada lado de 1 a 2 minutos.
4. Cubre el tazón de arroz con el huevo frito.'),
  ('Shrimp and pesto spaghetti', '1. Descongela los camarones antes de usar.
2. Cocina el espagueti según las instrucciones del paquete.
3. Escurre la pasta y agrega el pesto, los camarones descongelados y el espagueti cocido a un tazón. Mezcla bien para integrar y agrega el jugo de limón antes de servir.'),
  ('Simple chicken salad with croutons', '1. Enjuaga las verduras. Corta en cubos los tomates y las cebollas. Pica la lechuga.
2. Cocina la quinoa (sazónala a tu gusto).
3. Agrega las verduras a un tazón grande y cubre con los crutones, el aderezo y los trozos de pollo. Revuelve bien y ¡disfruta!'),
  ('Simple chicken with potato and green beans', '1. Pon a hervir una olla con agua y agrega una pizca de sal. Pela o lava las papas según tu preferencia (puedes partirlas a la mitad), luego agrégalas a la olla durante unos 15 minutos o hasta que estén suaves. Puedes comprobar si están cocidas atravesando la cáscara con un tenedor.
2. Cuando a las papas les queden unos 7 a 8 minutos en el agua, agrega los ejotes y cocina unos 7 minutos, o hasta que puedas atravesarlos con un tenedor.
3. Sazona el pollo con sal y pimienta. Fríe el pollo por todos lados en una sartén con aceite en aerosol a fuego medio-alto hasta que ya no esté rosado en el centro.
4. Sirve el pollo con los ejotes y las papas. Sazona con sal, pimienta y las hierbas o especias que desees.'),
  ('Simple chicken with rice and broccoli', '1. Cocina el arroz según las instrucciones del paquete en una olla con agua ligeramente salada.
2. Enjuaga el brócoli y córtalo en floretes pequeños. Pon a hervir otra olla con agua y agrega una pizca de sal. Agrega el brócoli y hiérvelo durante unos 3 minutos o hasta que esté tierno.
3. Fríe el pollo por todos lados en una sartén con el aceite a fuego medio-alto hasta que esté dorado y bien cocido, pero no seco.
4. Sirve el pollo con el arroz y el brócoli. ¡Disfruta!'),
  ('Simple jerk chicken with rice and mixed vegetables', '1. Sazona el pollo con el sazonador jerk. Fríe el pollo por ambos lados en una sartén con el aceite en aerosol a fuego medio-alto durante unos 10 minutos, hasta que el centro ya no esté rosado. Aparta.
2. En la misma sartén, fríe las verduras a fuego medio hasta que se calienten. Sazona con sal y pimienta. Calienta el arroz en el microondas según las instrucciones del paquete.
3. Sirve el pollo con el arroz y las verduras. ¡Disfruta!'),
  ('Simple oatmeal with blueberries and almonds', '1. Agrega la avena, la leche y una pizca de sal a una olla. Lleva todo a hervor, luego baja el fuego y deja cocer a fuego lento unos 3 minutos revolviendo constantemente. Agrega un poco más de agua para una consistencia más ligera si es necesario.
2. Mientras la avena se cocina, pica finamente las almendras y descongela los arándanos.
3. Sirve la avena en un tazón y cubre con los arándanos y las almendras picadas. ¡Disfruta!'),
  ('Simple peanut butter frappe', '1. Agrega todos los ingredientes a la licuadora excepto la crema para batir. Licúa unos 30 segundos o hasta obtener una consistencia uniforme y cremosa. Agrega un poco de agua o cubos de hielo para lograr la textura deseada si es necesario.
2. Agrega la crema para batir a un tazón pequeño. Bate bien hasta formar picos firmes.
3. Vierte el frappé en un vaso alto y cubre con la crema batida antes de servir.'),
  ('Simple steak with rice and broccoli', '1. Enjuaga el arroz antes de cocinarlo. Agrégalo a una olla con agua ligeramente salada y cocínalo según las instrucciones del paquete.
2. Enjuaga el brócoli y córtalo en floretes pequeños. También puedes cortar el tallo en trozos delgados, si lo deseas. Pon a hervir una olla con agua y agrega una pizca de sal. Agrega el brócoli y hiérvelo durante unos 3 minutos, o hasta que esté tierno.
3. Corta la carne en rebanadas de aproximadamente 1 pulgada de grosor si es necesario. Agrega la carne a una sartén con el aceite para dorarla unos minutos a fuego alto. Luego baja la temperatura y fríe las rebanadas por cada lado asegurándote de que la carne quede rosada en el centro. Sazona con sal y pimienta y deja reposar al menos 5 minutos antes de servir con el brócoli y el arroz.'),
  ('Smoky spice rub and honey lime glazed chicken thighs', '1. En un tazón, agrega la cebolla en polvo, la mitad del pimentón ahumado, el comino en polvo, el cilantro molido, la mitad del jugo de limón, el ajo y el aceite de oliva. Mezcla todos los ingredientes y agrega el pollo. Cubre el pollo y déjalo marinar por al menos 15 a 20 minutos.
2. Precalienta el horno a 400°F (convencional) o 350°F (con ventilador). Forra una bandeja con papel encerado y rocía el aceite en aerosol sobre el papel.
3. Coloca los trozos de pollo en la bandeja y hornea durante 25 minutos.
4. Mientras tanto, agrega el resto del jugo de limón y el pimentón ahumado, así como la pasta de tomate, la miel, el chile en polvo y cualquier marinada sobrante a un tazón grande.
5. Saca el pollo del horno y pásalo al tazón con la mezcla del glaseado. Revuelve para cubrir de manera uniforme, y luego coloca el pollo glaseado de nuevo en la bandeja. Hornea 7 minutos más hasta que el glaseado quede pegajoso y caramelizado.
6. Saca los trozos de pollo del horno, acomódalos en un platón y sirve.'),
  ('Smoky tilapia tacos with mango salsa', '1. Precalienta el horno en la función de gratinar (broiler). Descongela el elote.
2. Unta el pescado con el pimentón, el cilantro molido, el ajo en polvo y sal y pimienta. Coloca el pescado en una bandeja forrada y mételo al horno. Rocía con un poco de agua para evitar que se reseque. Gratina de 5 a 10 minutos, hasta que el pescado se desmenuce fácilmente.
3. Mientras tanto, parte el aguacate a la mitad y retira el hueso. Con una cuchara, saca la pulpa y colócala en un tazón. Machácala con sal, los chiles verdes y el cilantro fresco.
4. Pela y corta en cubos el mango y agrégalo a un tazón con el elote descongelado. Sazona con jugo de limón y un poco del cilantro fresco. Sazona con sal.
5. Calienta las tortillas en el horno o sobre la estufa. Rellena las tortillas con el pescado, la salsa de mango y la mezcla de aguacate. ¡Sirve y disfruta!'),
  ('Smoothie bowl with strawberry, banana, and cashews', '1. Pela y pica el plátano.
2. Agrega las fresas congeladas, el plátano, la proteína en polvo, los dátiles y la leche de almendras a una licuadora o procesador de alimentos. Licúa unos 30 segundos o hasta que quede suave. Tal vez necesites agregar un chorrito de agua para una consistencia más ligera.
3. Vierte el batido en un tazón y cubre con las semillas de chía y los anacardos.'),
  ('Smoothie with strawberries, banana and peanut butter', '1. Pela y rebana el plátano. Agrega todos los ingredientes a la licuadora. Agrega un poco de agua o cubos de hielo para lograr la textura deseada si es necesario. Licúa unos 30 segundos o hasta obtener una consistencia uniforme y cremosa.
2. Sirve el batido en un vaso.'),
  ('Smore crackers', '1. Coloca el chocolate sobre las galletas y aparta.
2. Agrega los malvaviscos a un tazón apto para microondas y caliéntalos hasta que empiecen a ablandarse y expandirse. Revuelve rápido y colócalos sobre las galletas graham.
3. Sirve los s''mores y disfruta con el requesón al lado.'),
  ('Spiced cod fillet with rice and naan bread', '1. Enjuaga el arroz antes de cocinarlo. Agrégalo a una olla con agua ligeramente salada y cocínalo según las instrucciones del paquete.
2. Corta el pescado en trozos pequeños. Mezcla el chile en polvo, el ajo, el comino, la cúrcuma, la especia tandoori, el jugo de limón y un poco de sal, luego cubre el pescado con la mezcla de especias.
3. Fríe el pescado en una sartén con el aceite a fuego medio-alto unos minutos por cada lado hasta que el pescado esté opaco y se desmenuce fácilmente. Enjuaga la espinaca.
4. Sirve el pescado frito con arroz, espinaca y pan naan. ¡Disfruta!'),
  ('Spicy beef with rice and broccoli', '1. Enjuaga el brócoli y córtalo en floretes pequeños. Corta la carne en cubos grandes.
2. Pon a hervir una olla con agua y agrega una pizca de sal. Cocina el arroz según las instrucciones del paquete.
3. Mientras tanto, calienta una sartén con el aceite en aerosol a temperatura media. Fríe la carne hasta que empiece a dorarse. Agrega el pimentón, el comino, el cilantro molido y el ajo y fríe otros 2 minutos. Luego agrega el puré de tomate y, si es necesario, un poco de agua, y deja cocer a fuego lento unos minutos.
4. Pon a hervir una olla con agua y agrega una pizca de sal. Agrega el brócoli y hiérvelo durante unos 3 minutos o hasta que esté tierno.
5. Sazona la carne con sal, pimienta y, si lo deseas, un poco de sirope de arce sin azúcar. Sirve la carne con el arroz y el brócoli.'),
  ('Spicy lime and turkey lettuce wraps', '1. Cocina la quinoa según las instrucciones del paquete en una olla con agua ligeramente salada.
2. Pela y ralla las zanahorias. Enjuaga y rebana el pimiento.
3. Calienta una sartén con aceite a fuego medio-alto y fríe el pavo molido hasta que se dore por completo. Una vez cocido, agrega las verduras y cocina hasta que estén tiernas.
4. Incorpora el jugo de limón, la salsa picante y el cilantro. Cocina de 1 a 2 minutos para que se evapore un poco del líquido.
5. Rellena las hojas de lechuga con el pavo, la quinoa y las verduras. Come el relleno restante aparte.'),
  ('Spinach and edamame salad with crispy spiced chickpeas 🌱', '1. Pon a hervir una olla pequeña con agua. Agrega el edamame y cocina solo 2 minutos, luego escúrrelo.
2. Escurre los garbanzos y sécalos con papel toalla. Corta el tempeh en cubos o rebanadas delgadas.
3. Calienta una sartén con el aceite de sésamo a fuego medio-alto y fríe los garbanzos y el tempeh. Cuando los garbanzos empiecen a dorarse, agrega el pimentón, el comino y el cilantro. Fríe unos minutos y luego retira del fuego.
4. Enjuaga y corta en cuartos los tomates cherry. Enjuaga y corta la lechuga romana en trozos pequeños. Enjuaga la espinaca.
5. Mezcla la lechuga, la espinaca, el edamame, los tomates cherry, los arándanos, el tempeh y los garbanzos en un tazón y sazona con sal, pimienta y jugo de limón. Sirve la ensalada.'),
  ('Spinach salad with sauteed shrimp and sweet potatoes 🛡️', '1. Descongela los camarones.
2. Pon a hervir una olla con agua y agrega una pizca de sal. Pela los camotes y córtalos en trozos, luego agrégalos a la olla durante unos 15 a 30 minutos o hasta que estén suaves. Puedes comprobar si están cocidos atravesando la cáscara con un tenedor antes de retirarlos de la olla.
3. Enjuaga y rebana las cebollitas de cambray.
4. Fríe los camarones con un chorrito de agua en una sartén caliente a fuego medio-alto unos minutos hasta que se pongan rosados y dejen de estar translúcidos. Sazona con sal, pimienta y cualquier otra hierba o especia de tu elección.
5. Mezcla la espinaca, los camotes, las cebollitas de cambray y los camarones en un tazón. Cubre con el aceite de oliva, el jugo de limón y sal y pimienta.'),
  ('Steph''s Ground Beef Protein Pasta', '1. Hierve agua y agrega la pasta. El tiempo de cocción está en la caja.
2. Prepara primero la carne molida.
3. Agrega la cantidad de salsa.
4. Mezcla y sirve.'),
  ('Stir fried vegetables with coconut milk 🌱', '1. Enjuaga el arroz antes de cocinarlo. Agrégalo a una olla con agua ligeramente salada y cocínalo según las instrucciones del paquete.
2. Enjuaga las verduras. Rebana la col y corta el brócoli en floretes pequeños.
3. Calienta una cacerola a fuego medio y agrega la col, el brócoli, el edamame y la leche de coco. Pon a hervir, luego baja el fuego y deja cocer a fuego lento unos 5 minutos. Sazona con sal, pimienta, salsa de soja y jugo de limón si lo deseas.
4. Sirve las verduras y la salsa en un tazón con el arroz y espolvorea los cacahuates encima.'),
  ('Strawberry and blueberry smoothie with milk', '1. Agrega todos los ingredientes a la licuadora. Licúa unos 30 segundos o hasta obtener una consistencia uniforme y cremosa. Agrega un poco de agua o cubos de hielo para lograr la textura deseada si es necesario y licúa de nuevo.
2. Sirve el batido en un vaso.'),
  ('Strawberry milkshake with chocolate', '1. Agrega todos los ingredientes a la licuadora. Licúa unos 30 segundos o hasta obtener una consistencia uniforme y cremosa. Agrega un poco de agua o cubos de hielo para lograr la textura deseada si es necesario.
2. Vierte la malteada en un vaso alto y sirve.'),
  ('Strawberry smoothie', '1. Agrega todos los ingredientes a la licuadora. Licúa unos 30 segundos o hasta obtener una consistencia uniforme y cremosa. Agrega un poco de agua o cubos de hielo para lograr la textura deseada si es necesario y licúa de nuevo.
2. Sirve el batido en un vaso.'),
  ('Summer roll salad with shrimp', '1. Enjuaga la col, el pimiento, la cebollita de cambray y el pepino. Pela la cebolla y la zanahoria. Córtalos en tiras o trozos pequeños. Escurre los brotes de bambú. Pica los cacahuates.
2. Calienta una sartén o wok a fuego medio con un poco del aceite y fríe brevemente la col. Ahora agrega el ajo, 1/3 de la salsa de soja y los camarones y deja cocer a fuego lento unos 5 minutos, luego aparta.
3. Cocina los fideos de arroz según las instrucciones del paquete en una olla con agua ligeramente salada. Deja enfriar y mezcla con el resto del aceite.
4. Mezcla el resto de la salsa de soja, el jugo de limón, el vinagre, el chile, el jengibre y la miel en un tazón.
5. Agrega todos los ingredientes a un tazón, agrega el aderezo y deja reposar la ensalada 30 minutos en el refrigerador antes de servir.'),
  ('Taco bowl with beef', '1. Enjuaga el arroz. Cocina el arroz según las instrucciones del paquete en una olla con agua ligeramente salada.
2. Escurre el elote y pela y pica la cebolla. Fríe el ajo y la cebolla en una sartén a fuego medio-alto hasta que se doren. Agrega la carne molida y el elote y cocina hasta que la carne se dore por completo. Sazona con la mezcla de especias para taco.
3. Enjuaga y corta en cubos los tomates.
4. Coloca el arroz en un tazón y cubre con la carne, la salsa, los tomates, la crema agria y el cilantro. ¡Disfruta!'),
  ('Tandoori salmon with rice and cucumber salad', '1. Precalienta el horno a 475°F (horno estándar) o 450°F (horno con ventilador).
2. Enjuaga el arroz antes de cocinarlo. Agrégalo a una olla con agua ligeramente salada y cocínalo según las instrucciones del paquete.
3. Enjuaga el pepino y pela la cebolla. Rebana la mitad del pepino con una mandolina o rebanador y corta la otra mitad en cubos. Pica la cebolla.
4. Mezcla el sazonador tandoori masala con la mitad del yogur en un tazón.
5. Corta el salmón en trozos pequeños y colócalo en un refractario. Vierte encima la mezcla de yogur tandoori y mezcla bien con el salmón. Cubre con el aceite. Hornea el salmón unos 10 a 15 minutos hasta que esté bien cocido.
6. Coloca el pepino rebanado y la cebolla morada picada en un tazón y mezcla bien con la mitad de la miel y el vinagre de vino blanco. Sazona al gusto con sal y pimienta.
7. Coloca el pepino en cubos en un tazón y mezcla bien con vinagre de vino blanco, el resto de la miel, el yogur y el sazonador tandoori. Agrega una pizca de sal.
8. Sirve el salmón con el arroz y la ensalada de pepino. ¡Buen provecho!'),
  ('Tandoori stew with chicken', '1. Enjuaga el arroz antes de cocinarlo. Cocina el arroz según las instrucciones del paquete.
2. Rebana finamente el pimiento. Pela y rebana las zanahorias.
3. Sazona el pollo con sal y pimienta y córtalo en cubos. Fríe el pollo en una olla a fuego medio-alto hasta que ya no esté rosado en el centro. Agrega el ajo y el sazonador tandoori a la olla, luego agrega la leche de coco, las zanahorias y el caldo.
4. Deja cocer a fuego lento de 5 a 6 minutos, luego agrega el pimiento.
5. Deja cocer a fuego lento otros 5 a 6 minutos antes de servir el arroz junto con el estofado tandoori. Cubre con cilantro finamente picado.'),
  ('Tex-Mex inspired turkey meatloaf', 'Nota: esta receta se prepara mejor como un solo pastel de carne y luego se corta en porciones individuales. Las cantidades de ingredientes para toda la receta se encuentran debajo de este procedimiento.
1. Precalienta el horno a 400°F (convencional) o 350°F (con ventilador). Rocía un refractario con aceite en aerosol.
2. Escurre y enjuaga los frijoles y el elote.
3. En un tazón grande, mezcla el pavo molido, los frijoles, el elote, los chiles verdes, la salsa, el sazonador para taco, el pan molido y las claras de huevo. Sazona con sal, pimienta y cualquier otra especia o hierba de tu elección. Mezcla bien hasta integrar todos los ingredientes.
4. Coloca la mezcla en el refractario y presiónala para formar un pastel de carne. Vierte la mitad de la salsa para enchiladas sobre la carne. Hornea durante 45 minutos.
5. Saca el pastel de carne del horno y vierte el resto de la salsa para enchiladas encima. Hornea otros 10 a 15 minutos, hasta que el centro ya no se vea rosado o un termómetro interno marque 160°F.
6. Cuando esté listo, saca el pastel de carne del horno, córtalo en rebanadas y sirve. ¡Disfruta!

Un pastel de carne completo (8 porciones - 2400 calorías, 300 calorías por porción) requiere:
- 1 lata de 15.25 oz (240g) de frijol negro
- 3/4 taza (110g) de pan molido
- 1/2 taza (120g) de salsa
- 3 piezas (90g) de claras de huevo
- 6 tazas (800g) de salsa para enchiladas
- 950g de pavo molido
- 1 lata de 8.5 oz (164g) de elote
- aceite en aerosol
- 1 sobre de 1 oz de sazonador para taco
- 2-3 chiles verdes'),
  ('Tilapia and rice', '1. Cocina el arroz según las instrucciones del paquete en una olla con agua ligeramente salada.
2. Sazona el pescado con sal y pimienta. Fríe el pescado en una sartén con el aceite en aerosol a fuego medio-alto hasta que se torne opaco y se desmenuce fácilmente.
3. Sirve todo junto en un plato y ¡disfruta!'),
  ('Toast with scrambled eggs', '1. Bate los huevos con un poco de sal y pimienta, luego viértelos en una sartén antiadherente y revuelve constantemente a fuego medio-alto hasta que cuajen y no quede huevo líquido visible.
2. Tuesta el pan y cubre con los huevos antes de servir.
3. Acompaña con frutas y yogur al lado.'),
  ('Tortilla wrap with pan fried chicken and tomato salsa', '1. Enjuaga la lechuga, el pepino y los tomates. Rebana los tomates y el pepino.
2. Sazona el pollo con sal y pimienta y córtalo en trozos pequeños. Fríe el pollo en una sartén con un chorrito de agua a fuego medio-alto durante unos 10 minutos, hasta que el centro ya no esté rosado.
3. Calienta la tortilla según las instrucciones del paquete o caliéntala en el horno a 475°F durante 4 minutos.
4. Agrega el tomate, el pepino, la salsa de tomate, el pollo y la lechuga a la tortilla y enróllala.
5. Sirve el wrap de tortilla caliente con las almendras al lado.'),
  ('Tuna with rice, avocado and cucumber', '1. Enjuaga el arroz antes de cocinarlo. Agrégalo a una olla con agua ligeramente salada y cocínalo según las instrucciones del paquete.
2. Escurre el atún. Enjuaga y rebana el pepino. Parte el aguacate a la mitad y retira el hueso. Con una cuchara, saca la pulpa y córtala en cubos.
3. Sirve el arroz con el atún, el pepino y el aguacate. Sazona con sal, pimienta y cualquier otra hierba o especia de tu elección.'),
  ('Turkey Stroganoff', '1. Cocina el arroz según las instrucciones del paquete en una olla con agua ligeramente salada.
2. Pela y pica la cebolla.
3. Corta el pavo en rebanadas de 1/2 a 1 pulgada de grosor. Fríe el pavo y las cebollas en la mantequilla en una sartén a fuego medio-alto de 5 a 7 minutos. Sazona con sal y pimienta.
4. Agrega la pasta de tomate, la mostaza, el vino blanco, la crema agria y suficiente agua para una salsa. Deja cocer a fuego lento, tapado, unos 5 a 10 minutos.
5. Sirve con el arroz y decora con un poco de perejil.'),
  ('Vanilla Glazed Donut', '1. Precalienta el horno a 350°F.
2. En un tazón, agrega 40 gramos (1/3 taza) de harina de avena, 15 gramos (~4 cucharaditas) de endulzante sin calorías, 7 gramos (1 1/2 cucharadita) de polvo para hornear, una pizca de sal, y mézclalo. Agrega 1 huevo grande, 100 gramos (~1/2 taza) de yogur griego de vainilla sin azúcar, 4 gramos (1 cucharadita) de extracto de vainilla y mezcla.
3. Rocía una toalla de papel con aceite de oliva en aerosol y engrasa
4. 4 de los moldes para dona de una bandeja para donas.
5. Coloca la mezcla en una bolsa Ziploc y haz un corte en una de las esquinas para hacer una manga pastelera. Llena cada uno de los 4 moldes para dona con la mezcla.
6. Hornéalas durante 15 minutos. Luego, déjalas enfriar unos 10 minutos.
7. En un tazón, agrega 30 gramos (~3/4 de medida) de proteína de vainilla en polvo, 40 gramos (~3 cucharadas) de yogur griego natural sin grasa, 5 a 8 gramos (1 a 2 cucharaditas) de endulzante sin calorías, 20 gramos (~1 1/4 cucharadita) de leche descremada, y mézclalo.
8. Glasea las donas con el betún de vainilla y cúbrelas con 8 gramos (2 cucharaditas) de chispas de colores.'),
  ('Vegan Mediterranean wraps', '1. Enjuaga el pepino. Ralla la mitad y luego espolvoréalo con una pizca de sal. Colócalo en un colador sobre un tazón y déjalo escurrir mientras picas el resto de las verduras.
2. Enjuaga el tomate y el pimiento. Retira las semillas del centro del pimiento. Pela la cebolla y luego corta en cubos la otra mitad del pepino, el tomate, la cebolla morada, el pimiento y las aceitunas.
3. Escurre y enjuaga los garbanzos, agrégalos a un tazón y machácalos con un tenedor.
4. Para hacer el tzatziki, exprime la mayor cantidad de agua posible del pepino rallado. En un tazón, combina el pepino rallado, el yogur, el eneldo, el ajo, el jugo de limón y sal y pimienta al gusto.
5. Agrega el tzatziki a los garbanzos machacados, sazona con sal y pimienta al gusto y mezcla bien.
6. Calienta la tortilla en una sartén a fuego medio-alto, si lo deseas. Coloca la tortilla en un plato, luego agrega la lechuga, los garbanzos machacados con tzatziki y las verduras en cubos encima. Enrolla como un wrap y sirve. Come la manzana al lado.'),
  ('Vegan Pasta ', '1. Hierve de 4 a 6 cuartos de agua con sal. Agrega 252 gramos (~2
2. 1/2 tazas) de pasta penne de lenteja roja y hierve de 8 a 10 minutos hasta la textura deseada (8 minutos para una textura más al dente).
3. Mientras la pasta se cocina, cocina las cebollas y el ajo en una sartén a fuego bajo-medio de 3 a 5 minutos, revolviendo cada 15 a 30 segundos hasta que las cebollas estén translúcidas y el ajo ligeramente dorado. Agrega 340 gramos (1 paquete) de carne molida Impossible, pícala e intégrala con las cebollas y el ajo. Cocina a fuego medio hasta que esté bien cocida. Pica constantemente la "carne" mientras se cocina. Agrega una pizca de sal y pimienta al gusto cuando la "carne" esté casi completamente cocida.'),
  ('Yogurt chicken korma with rice', '1. Enjuaga el arroz. Hierve el arroz en una olla con agua ligeramente salada según las instrucciones del paquete.
2. Pela y pica la cebolla. Enjuaga y pica el pimiento. Corta el pollo en trozos y sazona con sal, pimienta y otras especias o hierbas de tu elección.
3. Calienta una sartén a fuego medio con un chorrito de agua y agrega el cardamomo, la raja de canela, la cebolla, el pimiento, el ajo y el jengibre. Fríe alrededor de un minuto y luego agrega el pollo. Fríe el pollo unos 5 a 7 minutos hasta que la carne ya no esté rosada en el centro. Luego agrega el yogur y la leche de coco y baja el fuego. Cocina unos 10 minutos, revolviendo una o dos veces durante la cocción.
4. Retira la raja de canela antes de servir. Cubre el estofado con cilantro y jugo de limón y sirve con el arroz. ¡Disfruta!'),
  ('Yogurt with passion fruit, raspberries, almonds, and coconut', '1. Agrega el yogur a un tazón.
2. Parte el maracuyá a la mitad y usa una cuchara para sacar la pulpa. Desecha la cáscara.
3. Agrega el maracuyá, las frambuesas, las almendras, la miel y el coco al yogur y sirve.')
) as v(name_en, es) where r.name_en = v.name_en;
