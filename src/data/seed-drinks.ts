import type { Category, Drink } from '@/lib/drinks/types';

export const SEED_VERSION = 1;

export const SEED_CATEGORIES = [
  { id: 'shot',     label: 'Shots',        maxQuantity: 8 },
  { id: 'well',     label: 'Well Drinks',  maxQuantity: 2 },
  { id: 'cocktail', label: 'Cocktails',    maxQuantity: 2 },
  { id: 'martini',  label: 'Martinis',     maxQuantity: 2 },
] as const satisfies readonly Category[];

/**
 * Every `name` identifies exactly one drink, so a ticket is never guesswork:
 * a shot sharing a name with a cocktail or martini carries a `Shot` suffix
 * (Lemon Drop Shot vs Lemon Drop Martini), and `id` mirrors `name`.
 */
export const SEED_DRINKS = [
  // Elite Drink List 1
  { id: 'seed:dark-and-stormy',                  name: 'Dark and Stormy',                         categoryId: 'well',      enabled: true },
  { id: 'seed:moscow-mule',                      name: 'Moscow Mule',                             categoryId: 'well',      enabled: true },
  { id: 'seed:cape-cod',                         name: 'Cape Cod',                                categoryId: 'well',      enabled: true },
  { id: 'seed:cuba-libre',                       name: 'Cuba Libre',                              categoryId: 'well',      enabled: true },
  { id: 'seed:screwdriver',                      name: 'Screwdriver',                             categoryId: 'well',      enabled: true },
  { id: 'seed:fuzzy-navel',                      name: 'Fuzzy Navel',                             categoryId: 'well',      enabled: true },
  { id: 'seed:malibu-bay-breeze',                name: 'Malibu Bay Breeze',                       categoryId: 'well',      enabled: true },
  { id: 'seed:seven-and-seven',                  name: '7 & 7',                                   categoryId: 'well',      enabled: true },
  { id: 'seed:greyhound',                        name: 'Greyhound',                               categoryId: 'well',      enabled: true },
  { id: 'seed:tequila-sunrise',                  name: 'Tequila Sunrise',                         categoryId: 'well',      enabled: true },
  { id: 'seed:tequila-sunset',                   name: 'Tequila Sunset',                          categoryId: 'well',      enabled: true },
  { id: 'seed:midori-sour',                      name: 'Midori Sour',                             categoryId: 'well',      enabled: true },
  { id: 'seed:sea-breeze',                       name: 'Sea Breeze',                              categoryId: 'well',      enabled: true },
  { id: 'seed:bay-breeze',                       name: 'Bay Breeze',                              categoryId: 'well',      enabled: true },
  { id: 'seed:gin-and-juice',                    name: 'Gin and Juice',                           categoryId: 'well',      enabled: true },
  { id: 'seed:coco-loco',                        name: 'Coco Loco',                               categoryId: 'well',      enabled: true },
  { id: 'seed:amaretto-sour',                    name: 'Amaretto Sour',                           categoryId: 'well',      enabled: true },
  { id: 'seed:madras',                           name: 'Madras',                                  categoryId: 'well',      enabled: true },
  { id: 'seed:tom-collins',                      name: 'Tom Collins',                             categoryId: 'well',      enabled: true },
  { id: 'seed:salty-dog',                        name: 'Salty Dog',                               categoryId: 'well',      enabled: true },
  { id: 'seed:double-oh-seven',                  name: '007',                                     categoryId: 'well',      enabled: true },

  // Long Island Recipes
  { id: 'seed:long-island-iced-tea',             name: 'Long Island Iced Tea',                    categoryId: 'cocktail',  enabled: true },
  { id: 'seed:tokyo-tea',                        name: 'Tokyo Tea (Melon Long Island)',           categoryId: 'cocktail',  enabled: true },
  { id: 'seed:blue-long-island',                 name: 'Blue Long Island (Adios Mother F*cker)',  categoryId: 'cocktail',  enabled: true },
  { id: 'seed:long-beach-iced-tea',              name: 'Long Beach Iced Tea',                     categoryId: 'cocktail',  enabled: true },
  { id: 'seed:grateful-dead',                    name: 'Grateful Dead (Raspberry Long Island)',   categoryId: 'cocktail',  enabled: true },
  { id: 'seed:mongolian-mother-fucker',          name: 'Mongolian Mother F*cker',                 categoryId: 'cocktail',  enabled: true },

  // Elite Drink List 2
  { id: 'seed:alabama-slammer',                  name: 'Alabama Slammer',                         categoryId: 'cocktail',  enabled: true },
  { id: 'seed:godfather',                        name: 'Godfather',                               categoryId: 'cocktail',  enabled: true },
  { id: 'seed:godmother',                        name: 'Godmother',                               categoryId: 'cocktail',  enabled: true },
  { id: 'seed:hurricane',                        name: 'Hurricane',                               categoryId: 'cocktail',  enabled: true },
  { id: 'seed:black-russian',                    name: 'Black Russian',                           categoryId: 'cocktail',  enabled: true },
  { id: 'seed:white-russian',                    name: 'White Russian',                           categoryId: 'cocktail',  enabled: true },
  { id: 'seed:sicilian-kiss',                    name: 'Sicilian Kiss',                           categoryId: 'cocktail',  enabled: true },
  { id: 'seed:negroni',                          name: 'Negroni',                                 categoryId: 'cocktail',  enabled: true },
  { id: 'seed:gimlet-rocks',                     name: 'Gimlet, Rocks (Vodka or Gin)',            categoryId: 'cocktail',  enabled: true },
  { id: 'seed:kamikaze',                         name: 'Kamikaze',                                categoryId: 'cocktail',  enabled: true },
  { id: 'seed:blue-kamikaze',                    name: 'Blue Kamikaze',                           categoryId: 'cocktail',  enabled: true },
  { id: 'seed:mai-tai',                          name: 'Mai Tai',                                 categoryId: 'cocktail',  enabled: true },
  { id: 'seed:blue-hawaiian',                    name: 'Blue Hawaiian',                           categoryId: 'cocktail',  enabled: true },
  { id: 'seed:incredible-hulk',                  name: 'Incredible Hulk',                         categoryId: 'cocktail',  enabled: true },
  { id: 'seed:blue-lagoon',                      name: 'Blue Lagoon',                             categoryId: 'cocktail',  enabled: true },
  { id: 'seed:rusty-nail',                       name: 'Rusty Nail',                              categoryId: 'cocktail',  enabled: true },
  { id: 'seed:lynchburg-lemonade',               name: 'Lynchburg Lemonade',                      categoryId: 'cocktail',  enabled: true },
  { id: 'seed:sex-on-the-beach',                 name: 'Sex on the Beach',                        categoryId: 'cocktail',  enabled: true },
  { id: 'seed:margarita',                        name: 'Margarita',                               categoryId: 'cocktail',  enabled: true },
  { id: 'seed:bahama-mama',                      name: 'Bahama Mama',                             categoryId: 'cocktail',  enabled: true },

  // Elite Drink List 3 - Common Shots & Shooters
  { id: 'seed:kamikaze-shot',                    name: 'Kamikaze Shot',                           categoryId: 'shot',      enabled: true },
  { id: 'seed:sex-on-the-beach-shot',            name: 'Sex on the Beach Shot',                   categoryId: 'shot',      enabled: true },
  { id: 'seed:red-headed-slut',                  name: 'Red Headed Slut',                         categoryId: 'shot',      enabled: true },
  { id: 'seed:surfer-on-acid',                   name: 'Surfer on Acid',                          categoryId: 'shot',      enabled: true },
  { id: 'seed:washington-apple-shot',            name: 'Washington Apple Shot',                   categoryId: 'shot',      enabled: true },
  { id: 'seed:soco-and-lime-shot',               name: 'SoCo and Lime Shot',                      categoryId: 'shot',      enabled: true },
  { id: 'seed:liquid-cocaine',                   name: 'Liquid Cocaine',                          categoryId: 'shot',      enabled: true },
  { id: 'seed:lemon-drop-shot',                  name: 'Lemon Drop Shot',                         categoryId: 'shot',      enabled: true },
  { id: 'seed:chocolate-cake-shot',              name: 'Chocolate Cake Shot',                     categoryId: 'shot',      enabled: true },
  { id: 'seed:irish-breakfast-shot',             name: 'Irish Breakfast Shot',                    categoryId: 'shot',      enabled: true },
  { id: 'seed:orange-peel-shot',                 name: 'Orange Peel Shot',                        categoryId: 'shot',      enabled: true },
  { id: 'seed:key-lime-pie-shot',                name: 'Key Lime Pie Shot',                       categoryId: 'shot',      enabled: true },
  { id: 'seed:water-moccasin',                   name: 'Water Moccasin',                          categoryId: 'shot',      enabled: true },
  { id: 'seed:green-tea-shot',                   name: 'Green Tea Shot',                          categoryId: 'shot',      enabled: true },
  { id: 'seed:apple-sauce-shot',                 name: 'Apple Sauce Shot',                        categoryId: 'shot',      enabled: true },
  { id: 'seed:royal-flush',                      name: 'Royal Flush',                             categoryId: 'shot',      enabled: true },
  { id: 'seed:pineapple-upside-down-cake-shot',  name: 'Pineapple Upside Down Cake Shot',         categoryId: 'shot',      enabled: true },
  { id: 'seed:pink-starburst-shot',              name: 'Pink Starburst Shot',                     categoryId: 'shot',      enabled: true },
  { id: 'seed:jolly-rancher-shot',               name: 'Jolly Rancher Shot',                      categoryId: 'shot',      enabled: true },
  { id: 'seed:three-wisemen',                    name: '3 Wisemen',                               categoryId: 'shot',      enabled: true },
  { id: 'seed:johnny-vegas',                     name: 'Johnny Vegas',                            categoryId: 'shot',      enabled: true },

  // Elite Drink List 3 - Layered Shots & Bombs
  { id: 'seed:buttery-nipple',                   name: 'Buttery Nipple',                          categoryId: 'shot',      enabled: true },
  { id: 'seed:b-52',                             name: 'B-52',                                    categoryId: 'shot',      enabled: true },
  { id: 'seed:pickleback',                       name: 'Pickleback',                              categoryId: 'shot',      enabled: true },
  { id: 'seed:cherry-bomb',                      name: 'Cherry Bomb',                             categoryId: 'shot',      enabled: true },
  { id: 'seed:cinnamon-toast-crunch-shot',       name: 'Cinnamon Toast Crunch Shot',              categoryId: 'shot',      enabled: true },
  { id: 'seed:baby-guinness-shot',               name: 'Baby Guinness Shot',                      categoryId: 'shot',      enabled: true },
  { id: 'seed:vegas-bomb',                       name: 'Vegas Bomb',                              categoryId: 'shot',      enabled: true },
  { id: 'seed:blow-job',                         name: 'Blow Job',                                categoryId: 'shot',      enabled: true },
  { id: 'seed:orgasm',                           name: 'Orgasm',                                  categoryId: 'shot',      enabled: true },
  { id: 'seed:jager-bomb',                       name: 'Jager Bomb',                              categoryId: 'shot',      enabled: true },

  // Elite Drink List 4 - Martinis
  { id: 'seed:cosmopolitan',                     name: 'Cosmopolitan',                            categoryId: 'martini',   enabled: true },
  { id: 'seed:apple-martini',                    name: 'Apple Martini',                           categoryId: 'martini',   enabled: true },
  { id: 'seed:french-martini',                   name: 'French Martini',                          categoryId: 'martini',   enabled: true },
  { id: 'seed:watermelon-martini',               name: 'Watermelon Martini',                      categoryId: 'martini',   enabled: true },
  { id: 'seed:gimlet-martini',                   name: 'Gimlet Martini, Up',                      categoryId: 'martini',   enabled: true },
  { id: 'seed:chocolate-martini',                name: 'Chocolate Martini',                       categoryId: 'martini',   enabled: true },
  { id: 'seed:key-lime-martini',                 name: 'Key Lime Martini',                        categoryId: 'martini',   enabled: true },
  { id: 'seed:lemon-drop-martini',               name: 'Lemon Drop Martini',                      categoryId: 'martini',   enabled: true },
  { id: 'seed:espresso-martini',                 name: 'Espresso Martini',                        categoryId: 'martini',   enabled: true },
  { id: 'seed:lychee-martini',                   name: 'Lychee Martini',                          categoryId: 'martini',   enabled: true },
  { id: 'seed:classic-martini',                  name: 'Classic Martini (Gin or Vodka)',          categoryId: 'martini',   enabled: true },

  // Classic Cocktails - stirred and served up, so they order as martinis
  { id: 'seed:manhattan',                        name: 'Manhattan',                               categoryId: 'martini',   enabled: true },
  { id: 'seed:rob-roy',                          name: 'Rob Roy',                                 categoryId: 'martini',   enabled: true },
] as const satisfies readonly Drink[];
