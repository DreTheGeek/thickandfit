# Lenus -> Thick & Fit Migration Completeness Report

Legacy clients: **265**  |  with raw archive: **265**  |  with intake profile: **265**

## Totals across all clients
| Data | Rows migrated |
|---|---|
| Intake/health profiles | 265 |
| Weight entries | 758 |
| Body measurements | 496 |
| Food-diary entries | 6940 |
| Progress photos | 2286 |
| Coach notes (reminders) | 455 |
| Tag links | 316 |
| Conversation messages | 12021 |
| Chat attachments re-hosted | 2843 |
| Raw archive operations | 7134 |

## Conversations (client_messages)
- **12,021 messages** across **138 clients** (Coach Steph / Daniella / Nathalia + each client); 0 count
  mismatches vs source, 0 external_ids spanning two clients, 0 orphan rows.
- **Attachments:** 3,080 total. **2,843 re-hosted** (every image, voice note, PDF, and smaller video).
  **226 large videos (~22 GB, avg 100 MB)** intentionally NOT re-hosted (owner decision 2026-07-03):
  Supabase simple upload rejects 100 MB+ files (needs resumable/TUS) and it is an ~8 hr / 22 GB
  transfer. Originals remain on Lenus until ~Aug 2; the coach view shows a placeholder marker for them.
  The message rows + attachment metadata are fully preserved; only the video bytes are not re-hosted.

## Cross-mixing / integrity check (must all be 0 orphans)
| Table | Orphan rows (contact_id with no contact) |
|---|---|
| weight_entries | 0 |
| body_measurements | 0 |
| food_log | 0 |
| progress_photos | 0 |
| client_intake | 0 |

## Per-client detail
| Client | Intake | Weights | Measures | Food | Photos | Notes | Tags | RawOps |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| Aaliyah Baker | 1 | 2 | 1 | 0 | 6 | 1 | 2 | 27 |
| Abbie Jackson | 1 | 1 | 0 | 5 | 3 | 1 | 0 | 27 |
| Adrianna Jews | 1 | 2 | 1 | 0 | 6 | 1 | 2 | 27 |
| Adrianne Fleming | 1 | 4 | 2 | 0 | 12 | 1 | 2 | 27 |
| Aishah Lewis | 1 | 2 | 1 | 33 | 6 | 1 | 2 | 27 |
| Akiah Brown | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Alaysia Miller | 1 | 2 | 1 | 0 | 6 | 1 | 2 | 27 |
| Alesha Rojas | 1 | 2 | 1 | 14 | 6 | 2 | 0 | 27 |
| Alexandria Carrizales | 1 | 2 | 1 | 0 | 6 | 1 | 0 | 27 |
| Alexiah Agnew | 1 | 3 | 2 | 0 | 9 | 2 | 2 | 27 |
| Alexis Clarke | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Alexis Dansby | 1 | 1 | 0 | 0 | 3 | 1 | 0 | 27 |
| Alexis Ford | 1 | 3 | 2 | 0 | 9 | 1 | 0 | 27 |
| Alexis Grays | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 26 |
| Alexis Underwood | 1 | 1 | 0 | 103 | 3 | 1 | 0 | 27 |
| Ally Payne | 1 | 36 | 35 | 1 | 108 | 6 | 1 | 27 |
| Ama Mose | 1 | 8 | 7 | 318 | 24 | 5 | 0 | 27 |
| Amanda Johnson | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Amanda Santiago | 1 | 1 | 0 | 0 | 3 | 3 | 0 | 27 |
| Amaris Roman | 1 | 3 | 2 | 0 | 9 | 1 | 3 | 27 |
| Amy Langley | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Amy Sutherland | 1 | 1 | 0 | 306 | 3 | 1 | 2 | 27 |
| Ana Isabel Hernandez | 1 | 7 | 6 | 984 | 21 | 4 | 4 | 27 |
| Andréa Armstrong | 1 | 2 | 1 | 2 | 6 | 1 | 2 | 27 |
| Andrea Revilla | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 26 |
| Angel Thompson | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Angela Perkins | 1 | 1 | 0 | 8 | 3 | 2 | 0 | 27 |
| Angelica Carrington | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Angelica Cruz | 1 | 2 | 0 | 0 | 9 | 1 | 1 | 27 |
| Angelina Prado | 1 | 2 | 1 | 138 | 6 | 1 | 0 | 27 |
| Angie Deleon | 1 | 6 | 5 | 0 | 18 | 3 | 0 | 27 |
| Angie Nicholson | 1 | 2 | 1 | 1 | 6 | 1 | 2 | 27 |
| Anisha  Elder | 1 | 1 | 0 | 10 | 3 | 1 | 2 | 27 |
| April Aguirre | 1 | 1 | 0 | 16 | 3 | 1 | 2 | 27 |
| April Harris | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Ari Coleman | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Arie Mendez | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Ashleigh Jackson | 1 | 3 | 1 | 0 | 9 | 1 | 0 | 27 |
| Ashley Alba | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Ashley Bowser | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 26 |
| Ashley Smith | 1 | 2 | 1 | 0 | 6 | 1 | 2 | 27 |
| Ashma McDougall | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Avion Calhoun | 1 | 4 | 3 | 7 | 12 | 4 | 0 | 27 |
| Aviva Morales | 1 | 1 | 0 | 21 | 3 | 2 | 0 | 27 |
| Bethany Scales | 1 | 2 | 1 | 293 | 6 | 3 | 0 | 27 |
| Breanne Thomas | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 26 |
| Brenda Casas | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Brianna Richardson | 1 | 2 | 1 | 5 | 6 | 1 | 2 | 27 |
| Brigel Rodriguez | 1 | 4 | 3 | 114 | 12 | 5 | 1 | 27 |
| Britnee Barnes | 1 | 3 | 2 | 34 | 9 | 3 | 0 | 27 |
| Brittany Martin | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 26 |
| Briyana Ivey | 1 | 1 | 0 | 0 | 3 | 1 | 0 | 27 |
| Caranique  Russell | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Casi Haskins | 1 | 9 | 8 | 65 | 27 | 2 | 3 | 27 |
| Cassandra Girard | 1 | 1 | 0 | 0 | 3 | 1 | 0 | 27 |
| Cassandra Martins | 1 | 7 | 6 | 0 | 21 | 2 | 0 | 27 |
| Cassandra Martins | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Chanelle Battersby | 1 | 1 | 0 | 4 | 3 | 2 | 0 | 27 |
| Charde Young | 1 | 4 | 2 | 0 | 12 | 1 | 0 | 27 |
| Charlene Restituyo | 1 | 1 | 0 | 33 | 3 | 1 | 1 | 27 |
| Chelsea Nelson | 1 | 7 | 6 | 1 | 21 | 4 | 1 | 27 |
| Chenille Patterson | 1 | 4 | 3 | 0 | 12 | 5 | 1 | 27 |
| Chevanna Stewart | 1 | 1 | 0 | 0 | 3 | 1 | 0 | 27 |
| Cheyenne Harper | 1 | 1 | 0 | 10 | 3 | 1 | 0 | 27 |
| Christina Gomez | 1 | 2 | 1 | 0 | 9 | 1 | 2 | 27 |
| Ciara Dixon | 1 | 1 | 0 | 3 | 3 | 1 | 0 | 27 |
| Codi Starks | 1 | 2 | 1 | 78 | 6 | 1 | 2 | 27 |
| Colette Martin | 1 | 2 | 1 | 0 | 6 | 3 | 0 | 27 |
| Crystal Randall | 1 | 4 | 3 | 8 | 12 | 6 | 1 | 27 |
| Cyn Rios | 1 | 3 | 2 | 0 | 9 | 2 | 0 | 27 |
| Cynthia Cotes | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Cynthia Velasquez | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| D'Amani Wooten | 1 | 24 | 23 | 0 | 72 | 3 | 2 | 27 |
| Dani Sinisterra | 1 | 1 | 0 | 1 | 3 | 1 | 2 | 27 |
| Danyell Holmes | 1 | 1 | 0 | 0 | 3 | 1 | 0 | 27 |
| Darcil Francis | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Dasianae Burt | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 26 |
| Daytona Sullivan | 1 | 2 | 1 | 0 | 6 | 2 | 0 | 27 |
| Deanna Nolberto | 1 | 2 | 1 | 3 | 6 | 1 | 2 | 27 |
| Dee aguirre | 1 | 9 | 8 | 0 | 27 | 5 | 2 | 27 |
| Delia Chase | 1 | 18 | 17 | 452 | 54 | 3 | 1 | 27 |
| Demetria Johns | 1 | 1 | 0 | 22 | 3 | 2 | 0 | 27 |
| Destiny Dickerson | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Destiny Foreman | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Deyshanay May | 1 | 11 | 10 | 111 | 33 | 6 | 1 | 27 |
| Dia Mitchell | 1 | 1 | 0 | 0 | 3 | 2 | 1 | 27 |
| Dolly Paulino | 1 | 3 | 2 | 0 | 9 | 3 | 0 | 27 |
| Dominique Aguirre | 1 | 1 | 0 | 25 | 3 | 1 | 2 | 27 |
| Ebone Smith | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Ebony  Gills | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Elisia Edwards | 1 | 1 | 0 | 0 | 3 | 2 | 0 | 27 |
| Elizabeth Ortiz | 1 | 8 | 7 | 61 | 24 | 3 | 0 | 27 |
| Emmanuella Marc | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Erica  White | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Erica Robinson | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 26 |
| Erilyn Rodriguez | 1 | 5 | 4 | 5 | 15 | 1 | 2 | 27 |
| farah esteban | 1 | 3 | 1 | 10 | 9 | 1 | 2 | 27 |
| Finau Avatongo | 1 | 7 | 6 | 0 | 21 | 6 | 0 | 27 |
| Francesca pagan | 1 | 1 | 0 | 0 | 3 | 1 | 0 | 27 |
| Genesis Santos | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Gilary Gomez | 1 | 2 | 1 | 0 | 6 | 1 | 2 | 27 |
| Gloribel torres | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Heather Traverse | 1 | 2 | 1 | 22 | 6 | 1 | 2 | 27 |
| Iliana  Cortinas | 1 | 2 | 0 | 118 | 6 | 1 | 2 | 27 |
| Imani Atkins | 1 | 1 | 0 | 0 | 3 | 6 | 0 | 27 |
| Inae Park | 1 | 7 | 6 | 559 | 21 | 5 | 0 | 27 |
| India Calloway | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Ivery Taylor | 1 | 2 | 1 | 0 | 6 | 5 | 2 | 27 |
| Jackie Jimenez | 1 | 2 | 1 | 239 | 6 | 1 | 3 | 27 |
| Jacqueline Cadeau | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Jacqueline Cadeau | 1 | 15 | 14 | 128 | 45 | 3 | 0 | 27 |
| jacquelyn Esquerette | 1 | 1 | 0 | 0 | 3 | 2 | 0 | 27 |
| Jade Gmitter | 1 | 1 | 1 | 0 | 6 | 1 | 2 | 27 |
| Jaelynn Castillo | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Jakerra Brown | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Janiyah Reneè | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Jasmine  Smith | 1 | 1 | 0 | 4 | 3 | 1 | 2 | 27 |
| Jasmine Harvin | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Jasmine Henderson | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 26 |
| Jasmine Mabry | 1 | 1 | 0 | 1 | 3 | 1 | 2 | 27 |
| Jasmine Manning | 1 | 2 | 1 | 0 | 6 | 1 | 2 | 27 |
| Jasmine Milsap | 1 | 1 | 0 | 1 | 3 | 1 | 1 | 27 |
| Jazmine Langley | 1 | 4 | 2 | 1 | 12 | 2 | 2 | 27 |
| Jeffvancia Matthew | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 26 |
| Jessica  Plump | 1 | 2 | 1 | 0 | 6 | 1 | 2 | 27 |
| Jessica Hancox | 1 | 3 | 2 | 61 | 9 | 2 | 0 | 27 |
| Jessica Pope | 1 | 2 | 1 | 20 | 6 | 2 | 2 | 27 |
| Joanna Paris | 1 | 2 | 1 | 79 | 6 | 5 | 0 | 27 |
| Jordan Levingston | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Julie Glowiak | 1 | 4 | 2 | 127 | 12 | 2 | 2 | 27 |
| Kaila Mitchell | 1 | 4 | 3 | 0 | 12 | 1 | 1 | 27 |
| Kaitlyn Norton | 1 | 1 | 0 | 133 | 3 | 1 | 2 | 27 |
| Kathiushca Trinidad | 1 | 3 | 2 | 18 | 9 | 4 | 1 | 27 |
| Kayla Smith | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Kaylee Dilsaver | 1 | 4 | 3 | 33 | 12 | 3 | 0 | 27 |
| Kaylyn Freeman | 1 | 12 | 11 | 35 | 36 | 5 | 0 | 27 |
| Kicha May | 1 | 13 | 12 | 106 | 39 | 4 | 0 | 27 |
| Kiera Pierre | 1 | 2 | 0 | 0 | 6 | 1 | 2 | 27 |
| Kierra Jacode | 1 | 1 | 0 | 3 | 3 | 1 | 1 | 27 |
| Kim Hardy | 1 | 1 | 0 | 6 | 3 | 1 | 0 | 27 |
| Kristal Lee Acosta | 1 | 2 | 1 | 21 | 6 | 2 | 2 | 27 |
| Kristina  Quiles | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Kyra Steele | 1 | 1 | 0 | 13 | 3 | 1 | 2 | 27 |
| Lakeisha  Fo | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Lashun Bland | 1 | 2 | 1 | 0 | 6 | 1 | 0 | 27 |
| Laura Arguello | 1 | 12 | 9 | 2 | 36 | 5 | 0 | 27 |
| Laura Henriquez | 1 | 2 | 1 | 1 | 6 | 4 | 0 | 27 |
| Lauren Lo | 1 | 1 | 0 | 1 | 3 | 1 | 2 | 27 |
| Leeanna Ramirez | 1 | 2 | 1 | 0 | 9 | 1 | 2 | 27 |
| Lena Geffrard | 1 | 6 | 4 | 0 | 15 | 2 | 2 | 27 |
| Lexi Payne | 1 | 1 | 0 | 0 | 3 | 1 | 0 | 27 |
| Lexx Carter | 1 | 3 | 1 | 138 | 9 | 3 | 2 | 27 |
| Liliana Bishop | 1 | 1 | 0 | 0 | 3 | 1 | 0 | 27 |
| Lina Ramon | 1 | 1 | 0 | 13 | 3 | 2 | 1 | 27 |
| Lindsay Pittwood | 1 | 1 | 0 | 0 | 3 | 3 | 0 | 27 |
| Lisette Bumbury | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Liza Domingo | 1 | 1 | 0 | 8 | 3 | 2 | 0 | 27 |
| Lorrisa Singh | 1 | 4 | 3 | 0 | 12 | 3 | 1 | 27 |
| Loryn Green | 1 | 5 | 4 | 150 | 15 | 3 | 0 | 27 |
| Lourdes  Guerrero | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Mackenzie Francis | 1 | 2 | 1 | 0 | 6 | 4 | 1 | 27 |
| Maiya Harrell | 1 | 2 | 1 | 94 | 6 | 1 | 0 | 27 |
| Marcia Aguilar | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Maria Alvarenga | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Maria Cuy | 1 | 1 | 0 | 0 | 3 | 1 | 0 | 27 |
| Maria Figueroa | 1 | 2 | 1 | 124 | 6 | 2 | 1 | 27 |
| María Monasterios Ramirez | 1 | 3 | 2 | 4 | 9 | 1 | 2 | 27 |
| Mariah Fejeran | 1 | 2 | 1 | 0 | 6 | 2 | 0 | 27 |
| Maribel Martinez | 1 | 2 | 1 | 101 | 6 | 1 | 2 | 27 |
| Marijia Bailey | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Marissa Delgado | 1 | 6 | 5 | 0 | 18 | 3 | 2 | 27 |
| Marissa Eskina | 1 | 1 | 0 | 118 | 3 | 1 | 0 | 27 |
| MarkiLee Martinez | 1 | 0 | 0 | 0 | 0 | 1 | 2 | 26 |
| Marvelis  Reyes | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Mary  Weaver | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 26 |
| Matu Zama | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 26 |
| McKenna Crawford | 1 | 1 | 0 | 0 | 3 | 1 | 0 | 27 |
| Melaniese Foney | 1 | 1 | 0 | 0 | 3 | 1 | 0 | 27 |
| Melissa  Borjas | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Mereana Huata | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Micaela Hale | 1 | 11 | 9 | 3 | 33 | 4 | 1 | 27 |
| Michaela Loggins | 1 | 1 | 1 | 13 | 6 | 1 | 2 | 27 |
| Mileidy Guzman | 1 | 5 | 4 | 0 | 15 | 2 | 0 | 27 |
| Miya Green | 1 | 1 | 0 | 0 | 3 | 1 | 0 | 27 |
| Muriel Taylor | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 26 |
| Mychelle Walker | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Nadia Sharis | 1 | 3 | 2 | 68 | 9 | 3 | 1 | 27 |
| naimah muhammad | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Natalie Dorsey | 1 | 2 | 1 | 2 | 6 | 1 | 1 | 27 |
| Natasha Riggleman | 1 | 2 | 1 | 0 | 6 | 1 | 2 | 27 |
| Nicole  Thompson | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 26 |
| Nicole  Thompson | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Nicole Wilder | 1 | 1 | 0 | 60 | 3 | 1 | 2 | 27 |
| Noely Villatoro | 1 | 32 | 30 | 0 | 93 | 7 | 1 | 27 |
| Norma Rose | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Pamela Dessalines | 1 | 1 | 0 | 12 | 3 | 1 | 2 | 27 |
| Priscilla Henley | 1 | 1 | 0 | 4 | 3 | 6 | 2 | 27 |
| Raina Charity | 1 | 1 | 0 | 0 | 3 | 1 | 0 | 27 |
| Raquel Smith | 1 | 1 | 0 | 2 | 3 | 1 | 2 | 27 |
| Raven Schenck | 1 | 6 | 5 | 0 | 18 | 4 | 1 | 27 |
| Raylin Simmons | 1 | 11 | 10 | 31 | 33 | 2 | 1 | 27 |
| Renee Trimiew | 1 | 1 | 1 | 3 | 6 | 1 | 2 | 27 |
| Ronica Paul | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 26 |
| Ronnie  Riley | 1 | 3 | 1 | 0 | 9 | 2 | 2 | 27 |
| Ronnie Rileu | 1 | 0 | 0 | 0 | 0 | 1 | 2 | 26 |
| Ronya Green | 1 | 1 | 0 | 4 | 3 | 1 | 1 | 27 |
| Rosalynn Little | 1 | 1 | 0 | 5 | 3 | 1 | 0 | 27 |
| Ruth Roach | 1 | 1 | 0 | 1 | 3 | 1 | 2 | 27 |
| Sacha Whitfield | 1 | 2 | 1 | 24 | 6 | 3 | 0 | 27 |
| Samaya Ortiz | 1 | 2 | 1 | 2 | 6 | 1 | 2 | 27 |
| Samone  Fluellen | 1 | 12 | 10 | 0 | 36 | 2 | 1 | 27 |
| Sasha  Lamb | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Shametra Sanders | 1 | 4 | 3 | 0 | 12 | 3 | 0 | 27 |
| Shamika Carmen | 1 | 2 | 0 | 0 | 6 | 2 | 2 | 27 |
| Shanice Hayes | 1 | 4 | 2 | 61 | 12 | 2 | 1 | 27 |
| Shantel Rowe | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Sharae Henderson | 1 | 1 | 0 | 3 | 3 | 1 | 2 | 27 |
| Sheila  Dossantos | 1 | 2 | 1 | 0 | 6 | 1 | 2 | 27 |
| Shelise A Mardenborough | 1 | 59 | 58 | 14 | 177 | 4 | 0 | 27 |
| Shenoa Hunter | 1 | 1 | 0 | 19 | 3 | 2 | 1 | 27 |
| Sherita Smith | 1 | 2 | 1 | 252 | 6 | 1 | 2 | 27 |
| Sherita Smith | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 26 |
| Sonya Petty | 1 | 1 | 0 | 1 | 3 | 1 | 0 | 27 |
| Steph Atiga | 1 | 0 | 0 | 0 | 0 | 1 | 2 | 26 |
| Steph Test | 1 | 5 | 2 | 1 | 12 | 1 | 0 | 27 |
| Stephanie Craig | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 26 |
| Stephanie Cruz | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Stephanie Johnson | 1 | 1 | 0 | 0 | 3 | 2 | 1 | 27 |
| Stephanie Pantoja | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Stephanie Sierra | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Stephanie Villalobos | 1 | 1 | 0 | 0 | 3 | 1 | 0 | 27 |
| Susan Zorrilla | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Suzette Rosario | 1 | 1 | 0 | 0 | 3 | 9 | 1 | 27 |
| Sydnee Pate-Sansbury | 1 | 2 | 1 | 91 | 6 | 1 | 3 | 27 |
| T Nicole | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Takeria  Gipson | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Tamera Dixon | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Tamika  Cook | 1 | 1 | 0 | 5 | 3 | 1 | 1 | 27 |
| Tamika Cook | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Tanicka Kirk | 1 | 3 | 2 | 0 | 9 | 3 | 0 | 27 |
| TaNyia Jurineack | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Tatum Dobson | 1 | 7 | 6 | 67 | 21 | 3 | 0 | 27 |
| Tekiera Hemingway | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| TeQuella Winstead | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Thais Carvalho | 1 | 2 | 1 | 0 | 6 | 1 | 0 | 27 |
| Thalia Luna | 1 | 3 | 2 | 78 | 9 | 1 | 2 | 27 |
| Tierra Washington | 1 | 2 | 1 | 11 | 6 | 1 | 2 | 27 |
| Tiesha Bailey | 1 | 0 | 0 | 0 | 0 | 1 | 2 | 26 |
| Tiffany Downing | 1 | 5 | 5 | 119 | 18 | 1 | 2 | 27 |
| Tiffany Felder | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Tiffany Owens | 1 | 1 | 0 | 18 | 3 | 1 | 1 | 27 |
| Tilisa Polutele | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 26 |
| Toya Cooper | 1 | 2 | 0 | 80 | 6 | 1 | 0 | 27 |
| Tris-Ann Falconer | 1 | 1 | 0 | 0 | 3 | 2 | 0 | 27 |
| Tristan Hubbard | 1 | 1 | 0 | 4 | 3 | 1 | 2 | 27 |
| Tylla Oliver | 1 | 2 | 1 | 0 | 6 | 1 | 2 | 27 |
| Uto Unite | 1 | 1 | 0 | 0 | 3 | 1 | 2 | 27 |
| Victoria  Anderson | 1 | 2 | 1 | 0 | 6 | 1 | 2 | 27 |
| Victoria Elliott | 1 | 7 | 6 | 0 | 21 | 4 | 4 | 27 |
| Yancy Greer | 1 | 1 | 0 | 9 | 3 | 1 | 2 | 27 |
| Yashara  McDonald | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Yireh piñeiro Marte | 1 | 1 | 0 | 5 | 3 | 2 | 4 | 27 |
| Yvonne Williams | 1 | 3 | 2 | 3 | 9 | 2 | 1 | 27 |
| Zakeya Dodson | 1 | 1 | 0 | 0 | 3 | 1 | 1 | 27 |
| Zenobia Williams | 1 | 27 | 26 | 78 | 81 | 4 | 0 | 27 |