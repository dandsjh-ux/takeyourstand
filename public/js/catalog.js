// Shared catalog: used by both the browser and the Node server.
// Pure data, no imports. Item "look" params drive the procedural 3D builders in wardrobe.js.

export const ARMOR_SLOTS = ['belt', 'breastplate', 'shoes', 'shield', 'helmet', 'sword'];

export const CATEGORIES = [
  { id: 'me', label: 'Me', icon: '🙂', zoom: 'head', title: 'Create your character',
    verse: 'You are fearfully and wonderfully made. (Psalm 139:14)' },
  { id: 'tunic', label: 'Tunic', icon: '👘', zoom: 'full', title: 'Choose your clothes',
    verse: 'Clothe yourselves with compassion, kindness and humility. (Colossians 3:12)' },
  { id: 'belt', label: 'Belt', icon: '🪢', zoom: 'waist', title: 'Belt of Truth',
    verse: 'Stand firm, with the belt of truth buckled around your waist. (Ephesians 6:14)' },
  { id: 'breastplate', label: 'Breastplate', icon: '🦺', zoom: 'chest', title: 'Breastplate of Righteousness',
    verse: 'Put on the breastplate of righteousness. (Ephesians 6:14)' },
  { id: 'shoes', label: 'Shoes', icon: '👡', zoom: 'feet', title: 'Shoes of the Gospel of Peace',
    verse: 'Feet fitted with the readiness that comes from the gospel of peace. (Ephesians 6:15)' },
  { id: 'shield', label: 'Shield', icon: '🛡️', zoom: 'shield', title: 'Shield of Faith',
    verse: 'Take up the shield of faith. (Ephesians 6:16)' },
  { id: 'helmet', label: 'Helmet', icon: '⛑️', zoom: 'head', title: 'Helmet of Salvation',
    verse: 'Take the helmet of salvation. (Ephesians 6:17)' },
  { id: 'sword', label: 'Sword', icon: '📜', zoom: 'sword', title: 'Sword of the Spirit',
    verse: 'The sword of the Spirit, which is the word of God. (Ephesians 6:17)' },
  { id: 'bonus', label: 'Bonus', icon: '👑', zoom: 'full', title: 'Bonus Wardrobe',
    verse: 'Robes, crowns and treasures from the stories of the Bible.' },
  { id: 'prayer', label: 'Prayer', icon: '🙏', zoom: 'prayer', title: 'Your Prayer',
    verse: 'Pray in the Spirit on all occasions. (Ephesians 6:18)' },
  { id: 'runway', label: 'Runway', icon: '✨', zoom: 'full', title: 'Runway walk & poses',
    verse: 'Take your stand! (Ephesians 6:11)' },
];

export const SKIN_TONES = ['#f4d6bd', '#eac19e', '#dcaa80', '#c88f62', '#ad7349', '#8d5a37', '#6e4128', '#4f2d1b'];
export const HAIR_COLORS = ['#17110e', '#38231a', '#5a3521', '#7d3b1f', '#9f6b36', '#c9a061', '#8e8a86'];
export const HAIR_STYLES = [
  { id: 'crop', name: 'Cropped Curls' },
  { id: 'coils', name: 'Short Coils' },
  { id: 'wavy', name: 'Wavy Crop' },
  { id: 'curly', name: 'Dark Curls' },
  { id: 'shoulder', name: 'Shoulder Waves' },
  { id: 'braidcrown', name: 'Braided Crown' },
  { id: 'lowknot', name: 'Low Knot' },
  { id: 'braid', name: 'Long Braid' },
  { id: 'lowbun', name: 'Coiled Bun' },
  { id: 'twists', name: 'Side Twists' },
  { id: 'loop', name: 'Low Loop' },
  { id: 'puffs', name: 'Twin Puffs' },
];
export const BODIES = [
  { id: 'boy', name: 'Boy' },
  { id: 'girl', name: 'Girl' },
];

// ---- Items -------------------------------------------------------------
// price 0 = free default. icon: path under /img/items or null (rendered from 3D at runtime).
const I = (id, cat, name, price, look, extra = {}) => ({ id, cat, name, price, look, icon: extra.noIcon ? null : `/img/items/${id}.webp`, ...extra });

export const ITEMS = [
  // TUNICS (base clothes)
  I('tunic-v1', 'tunic', 'Sand Linen Tunic', 0, { kind: 'tunic', color: '#d9c9a8', trim: '#c2ad86', len: 'knee', under: '#e9e0cc', sleeve: 'short', belt: '#8a5a33' }),
  I('tunic-v2', 'tunic', 'Sage Tunic', 0, { kind: 'tunic', color: '#8f9c6c', trim: '#7b8a5a', len: 'knee', under: '#e4dcc6', sleeve: 'short' }),
  I('tunic-g1', 'tunic', 'Dusty Rose Dress', 0, { kind: 'dress', color: '#c48686', collar: '#dcc9a0', len: 'ankle', sleeve: 'elbow', pleats: true }),
  I('tunic-v3', 'tunic', 'Terracotta Tunic', 15, { kind: 'tunic', color: '#b0603e', trim: '#8f4a2e', len: 'knee', under: '#e4d6bc', sleeve: 'short' }),
  I('tunic-g2', 'tunic', 'Olive Grove Dress', 15, { kind: 'dress', color: '#717b44', trim: '#c9a24a', len: 'ankle', sleeve: 'elbow', sleeveBand: 'olive' }),
  I('tunic-v4', 'tunic', 'Indigo Tunic', 20, { kind: 'tunic', color: '#3d4c80', trim: '#2c3866', len: 'knee', under: '#e4dcc6', sleeve: 'short' }),
  I('tunic-g3', 'tunic', 'Lapis & Sand Gown', 20, { kind: 'dress', color: '#5b6b97', panel: '#dcc49a', len: 'ankle', sleeve: 'elbow', beads: '#e8e0d0' }),
  I('tunic-v5', 'tunic', 'Date-Brown Tunic', 25, { kind: 'tunic', color: '#7c5236', trim: '#5f3e28', len: 'knee', under: '#e9dfc8', sleeve: 'short' }),
  I('tunic-g4', 'tunic', 'Mulberry Drape', 25, { kind: 'dress', color: '#e8dcc4', drape: '#7f3f5e', len: 'ankle', sleeve: 'elbow' }),
  I('tunic-v6', 'tunic', 'Linen & Blue Trim', 30, { kind: 'tunic', color: '#e6dcc6', trim: '#6f86b0', len: 'knee', under: '#ece4d2', sleeve: 'short' }),
  I('tunic-g5', 'tunic', 'Pomegranate Gown', 30, { kind: 'dress', color: '#a2412f', hem: 'geo', trim: '#d1a447', len: 'ankle', sleeve: 'elbow' }),
  I('tunic-g6', 'tunic', 'Pearl & Honey Layers', 35, { kind: 'dress', color: '#efe5d3', layer: '#dbbd85', trim: '#c9a24a', len: 'ankle', sleeve: 'elbow', hem: 'leaf' }),
  I('tunic-x1', 'tunic', 'Galilee Fisher Tunic', 25, { kind: 'tunic', color: '#4f86a6', trim: '#f0ead8', len: 'knee', under: '#e9e1cd', sleeve: 'short', stripes: '#f0ead8' }, { noIcon: true }),
  I('tunic-x2', 'tunic', 'Shepherd Stripes', 25, { kind: 'tunic', color: '#a98a62', trim: '#5f4630', len: 'knee', under: '#e9e1cd', sleeve: 'short', stripes: '#5f4630' }, { noIcon: true }),
  I('tunic-x3', 'tunic', 'Lydia\'s Purple', 35, { kind: 'dress', color: '#6a3f86', trim: '#d6ae52', len: 'ankle', sleeve: 'elbow', hem: 'geo' }, { noIcon: true }),

  // BELT OF TRUTH
  I('belt-v1', 'belt', 'Flax Knot Sash', 0, { style: 'sash', color: '#ddd0b3', knot: true, tails: true }),
  I('belt-v2', 'belt', 'Braided Cord', 0, { style: 'cord', color: '#b88f5c', toggle: '#8a5a33' }),
  I('belt-g1', 'belt', 'Rosette Sash', 0, { style: 'sash', color: '#cf9494', knot: true, rosette: '#e9b9b0', tails: true }),
  I('belt-v3', 'belt', 'Russet Buckle Strap', 15, { style: 'strap', color: '#7c3f24', buckle: 'rect', metal: 'bronze' }),
  I('belt-g2', 'belt', 'Olive Leaf Wrap', 15, { style: 'strap', color: '#6f7a45', edge: '#c9a24a', buckle: 'leaf', metal: 'bronze' }),
  I('belt-v4', 'belt', 'Indigo Step Sash', 20, { style: 'sash', color: '#2f3d6d', edge: '#e2d6bb', knot: true, side: true, tails: true }),
  I('belt-g3', 'belt', 'Lapis Gem Belt', 20, { style: 'strap', color: '#35539a', buckle: 'almond', gem: '#1f3f9a', metal: 'brass' }),
  I('belt-v5', 'belt', 'Bronze Plate Belt', 25, { style: 'strap', color: '#6b3e22', plates: 3, buckle: 'round', metal: 'bronze', wide: true }),
  I('belt-g4', 'belt', 'Mulberry Lily Braid', 25, { style: 'cord', color: '#7f3f5e', edge: '#efe6d2', buckle: 'lily', metal: 'bronze' }),
  I('belt-v6', 'belt', 'Linen Double Wrap', 30, { style: 'double', color: '#e9dfca', edge: '#c9a24a', buckle: 'round', metal: 'brass' }),
  I('belt-g5', 'belt', 'Pomegranate Seed Belt', 30, { style: 'strap', color: '#9b2c2c', plates: 3, tassel: '#b8332b', metal: 'bronze' }),
  I('belt-g6', 'belt', 'Pearl Golden Loops', 35, { style: 'double', color: '#f0e8da', edge: '#d4a95a', buckle: 'loops', metal: 'gold' }),
  I('belt-x1', 'belt', 'Golden Cord of Truth', 35, { style: 'cord', color: '#d4a640', buckle: 'round', metal: 'gold' }, { noIcon: true }),

  // BREASTPLATE OF RIGHTEOUSNESS
  I('breastplate-v1', 'breastplate', 'Quilted Flax Vest', 0, { style: 'quilt', color: '#ddd0b3' }),
  I('breastplate-v2', 'breastplate', 'Olive Medallion Vest', 0, { style: 'vest', color: '#8a9a6b', medallion: 'olive', metal: 'bronze' }),
  I('breastplate-g1', 'breastplate', 'Rose Petal Quilt', 0, { style: 'quilt', color: '#c98a8a', petal: true, edge: 'bronze' }),
  I('breastplate-v3', 'breastplate', 'Russet Band Guard', 15, { style: 'bands', color: '#8c4a2b', count: 4 }),
  I('breastplate-g2', 'breastplate', 'Sage Leather Shell', 15, { style: 'vest', color: '#7c8c58', medallion: 'olive', metal: 'bronze', leather: true }),
  I('breastplate-v4', 'breastplate', 'Indigo Bronze Scales', 20, { style: 'scales', color: '#2f3d6d', scale: '#b07a43', metal: 'bronze' }),
  I('breastplate-g3', 'breastplate', 'Lapis Scale Shell', 20, { style: 'scales', color: '#35539a', scale: '#4766ad', edgeC: '#d8b24c', gem: '#1f3f9a' }),
  I('breastplate-v5', 'breastplate', 'Hide Plate Guard', 25, { style: 'plates', color: '#4a3226', rivets: 'bronze' }),
  I('breastplate-g4', 'breastplate', 'Lily Bronze Cuirass', 25, { style: 'cuirass', metal: 'bronze', emblem: 'lily', side: '#7f3f5e' }),
  I('breastplate-v6', 'breastplate', 'Sun Bronze Cuirass', 30, { style: 'cuirass', metal: 'bronze', emblem: 'sun' }),
  I('breastplate-g5', 'breastplate', 'Pomegranate Cuirass', 30, { style: 'cuirass', color: '#9b2c2c', sideMetal: 'copper', emblem: 'pomegranate' }),
  I('breastplate-g6', 'breastplate', 'Pearl Lotus Shell', 35, { style: 'quilt', color: '#efe7d8', layers: true, collar: 'gold', emblem: 'lotus' }),
  I('breastplate-x1', 'breastplate', 'Dove of Peace Plate', 35, { style: 'cuirass', metal: 'pewter', emblem: 'dove' }, { noIcon: true }),

  // SHOES OF THE GOSPEL OF PEACE
  I('shoes-v1', 'shoes', 'Tan Two-Band Sandals', 0, { color: '#c49a6c', bands: [0.35, 0.7], ankle: true }),
  I('shoes-v2', 'shoes', 'Caramel Rope Sandals', 0, { color: '#bd8a50', bands: [0.4, 0.72], cross: true, rope: true }),
  I('shoes-g1', 'shoes', 'Rose Scallop Sandals', 0, { color: '#cf9494', bands: [0.45, 0.72], wide: true, ankle: true, bow: true }),
  I('shoes-v3', 'shoes', 'Terracotta Cross Straps', 15, { color: '#a4502e', bands: [0.75], cross: true, ankle: true, accent: 'bronze' }),
  I('shoes-g2', 'shoes', 'Olive Branch Sandals', 15, { color: '#6f7a45', bands: [0.7], cross: true, ankle: true, accent: 'bronze' }),
  I('shoes-v4', 'shoes', 'Indigo Wraps', 20, { color: '#2f3d6d', bands: [0.3, 0.55, 0.8], wrap: 1, tie: '#c49a6c' }),
  I('shoes-g3', 'shoes', 'Blue Woven Wraps', 20, { color: '#5a73a8', bands: [0.5, 0.75], cross: true, ankle: true, tie: '#c49a6c', gem: '#2b5fc0' }),
  I('shoes-v5', 'shoes', 'Traveler Ankle Sandals', 25, { color: '#6b3e22', bands: [0.4, 0.75], high: 3, sole: '#3a2418' }),
  I('shoes-g4', 'shoes', 'Mulberry Crisscross', 25, { color: '#7f3f5e', bands: [0.75], cross: true, ankle: true, accent: 'bronze' }),
  I('shoes-v6', 'shoes', 'Honey Dress Sandals', 30, { color: '#e6dcc6', color2: '#c9954f', bands: [0.4, 0.7], ankle: true, accent: 'brass' }),
  I('shoes-g5', 'shoes', 'Pomegranate Slings', 30, { color: '#9b2c2c', bands: [0.55, 0.78], heel: true, accent: 'bronze' }),
  I('shoes-g6', 'shoes', 'Pearl Gold-Thread Sandals', 35, { color: '#efe7d8', bands: [0.72], cross: true, high: 2, tie: '#d4a95a', accent: 'gold' }),
  I('shoes-x1', 'shoes', 'Sunrise Messenger Sandals', 35, { color: '#e08a3c', color2: '#f3c14d', bands: [0.35, 0.6, 0.8], ankle: true, high: 1, accent: 'gold' }, { noIcon: true }),

  // SHIELD OF FAITH
  I('shield-v1', 'shield', 'Rawhide Round Shield', 0, { shape: 'circle', face: '#dcc8a0', rim: '#a77a4a', emblem: 'stitch' }),
  I('shield-v2', 'shield', 'Cedar Olive Shield', 0, { shape: 'oval', face: '#8f9c6c', rim: '#bf955f', emblem: 'olive', emblemC: '#c9a24a' }),
  I('shield-g1', 'shield', 'Rose Scallop Shield', 0, { shape: 'scallop', face: '#cf9494', rim: '#b98a6a', emblem: 'rosette', emblemC: '#c18a4a' }),
  I('shield-v3', 'shield', 'Rust Tower Shield', 15, { shape: 'rect', face: '#9b3a26', rim: 'bronze', boss: 'gold' }),
  I('shield-g2', 'shield', 'Olive Laurel Shield', 15, { shape: 'almond', face: '#6f7a45', rim: 'bronze', emblem: 'laurel', emblemC: '#d2a84f' }),
  I('shield-v4', 'shield', 'Indigo Sunburst Shield', 20, { shape: 'circle', face: '#2f3d6d', rim: 'bronze', emblem: 'sunburst', emblemC: '#c89150', boss: 'bronze' }),
  I('shield-g3', 'shield', 'Lapis Star Shield', 20, { shape: 'octagon', face: '#2f4a8a', rim: 'brass', emblem: 'petal8', emblemC: '#d8b24c' }),
  I('shield-v5', 'shield', 'Chestnut Teardrop', 25, { shape: 'teardrop', face: '#6b3e22', rim: 'bronze', boss: 'bronze' }),
  I('shield-g4', 'shield', 'Mulberry Lily Shield', 25, { shape: 'oval', face: '#7f3f5e', rim: '#c9a77a', emblem: 'lily', emblemC: '#e2c48e' }),
  I('shield-v6', 'shield', 'Radiant Sun Shield', 30, { shape: 'squircle', face: '#efe0c0', rim: '#c9954f', emblem: 'sun', emblemC: '#b9813f' }),
  I('shield-g5', 'shield', 'Pomegranate Shield', 30, { shape: 'rect', face: '#9b2c2c', rim: 'copper', emblem: 'pomegranate', emblemC: '#e0b04f' }),
  I('shield-g6', 'shield', 'Ivory Lotus Shield', 35, { shape: 'egg', face: '#efe7d8', rim: '#d9c49a', emblem: 'lotus', emblemC: '#c9a24a' }),
  I('shield-x1', 'shield', 'Ichthys Shield', 35, { shape: 'circle', face: '#e9dfc4', rim: '#3b6aa0', emblem: 'fish', emblemC: '#2f5d93' }, { noIcon: true }),

  // HELMET OF SALVATION
  I('helmet-v1', 'helmet', 'Leather Cap', 0, { dome: '#a87a4b', liner: '#e2d6bb', neck: true, stitch: true }),
  I('helmet-v2', 'helmet', 'Bronze Dome', 0, { metal: 'bronze', liner: '#8f9c6c', cheeks: true }),
  I('helmet-g1', 'helmet', 'Rose Rosette Helm', 0, { dome: '#cf9494', liner: '#d8c59c', emblem: 'rosette', emblemMetal: 'bronze', band: 'bronze' }),
  I('helmet-v3', 'helmet', 'Copper Ridge Helm', 15, { metal: 'copper', liner: '#8c4a2b', ridge: true, brow: true }),
  I('helmet-g2', 'helmet', 'Laurel Bronze Helm', 15, { metal: 'olivebronze', liner: '#e2d6bb', band: 'gold', emblem: 'laurel', cheeks: true }),
  I('helmet-v4', 'helmet', 'Blue Bronze Helm', 20, { metal: 'bluebronze', liner: '#2f3d6d', bandC: '#2f3d6d', neck: true, cheeks: true }),
  I('helmet-g3', 'helmet', 'Slate Gem Helm', 20, { metal: 'slate', liner: '#e8dfcc', band: 'gold', gem: '#2b5fc0' }),
  I('helmet-v5', 'helmet', 'Banded Leather Helm', 25, { dome: '#6b3e22', liner: '#c9b590', bands: 5, metalBands: 'bronze', cheeks: true }),
  I('helmet-g4', 'helmet', 'Mulberry Lily Helm', 25, { metal: 'bronze', liner: '#7f3f5e', bandC: '#7f3f5e', emblem: 'lily', cheeks: true }),
  I('helmet-v6', 'helmet', 'Sun Crest Helm', 30, { metal: 'gold', liner: '#e8dfcc', crest: '#efe3c6', emblem: 'sun', cheeks: true }),
  I('helmet-g5', 'helmet', 'Pomegranate Helm', 30, { metal: 'copper', liner: '#8c4a2b', ridge: true, emblem: 'pomegranate' }),
  I('helmet-g6', 'helmet', 'Golden Lotus Helm', 35, { metal: 'gold', liner: '#e8dfcc', emblem: 'lotus', cheeks: true, browPlate: true }),
  I('helmet-x1', 'helmet', 'Morning Star Helm', 35, { metal: 'pewter', liner: '#3b6aa0', crest: '#3b6aa0', emblem: 'star', cheeks: true }, { noIcon: true }),

  // SWORD OF THE SPIRIT (blunt, symbolic props)
  I('sword-v1', 'sword', 'Cedar Stage Sword', 0, { blade: '#e0c79a', grip: '#b98a56', guard: 'curve', guardC: '#b98a56', pommel: 'wood' }),
  I('sword-v2', 'sword', 'Olive Bronze Sword', 0, { blade: 'bronze', grip: '#8f9c6c', guard: 'bar', guardC: 'bronze', emblem: 'olive' }),
  I('sword-g1', 'sword', 'Rose Petal Sword', 0, { blade: '#ead7b6', grip: '#cf9494', guard: 'petal', guardC: 'bronze' }),
  I('sword-v3', 'sword', 'Russet Paddle Sword', 15, { blade: '#8c4a2b', grip: '#6b3e22', guard: 'bar', guardC: 'bronze', pommel: 'bronze', wide: true }),
  I('sword-g2', 'sword', 'Laurel Sword', 15, { blade: '#8a9465', grip: '#9aa77a', guard: 'bar', guardC: 'gold', emblem: 'laurel' }),
  I('sword-v4', 'sword', 'Pewter Sun Sword', 20, { blade: 'pewter', grip: '#2f3d6d', guard: 'bar', guardC: 'pewter', pommel: 'sun' }),
  I('sword-g3', 'sword', 'Lapis Bead Sword', 20, { blade: '#5b6b97', grip: '#35539a', guard: 'almond', guardC: 'brass', gem: '#2b5fc0' }),
  I('sword-v5', 'sword', 'Chestnut Oval Sword', 25, { blade: '#5d3a22', grip: '#3a2418', guard: 'oval', guardC: 'bronze', stripe: 'bronze' }),
  I('sword-g4', 'sword', 'Mulberry Lily Sword', 25, { blade: '#e6d2ae', grip: '#7f3f5e', guard: 'curve', guardC: 'brass', emblem: 'lily' }),
  I('sword-v6', 'sword', 'Ivory Scroll Sword', 30, { blade: '#f1e8d6', grip: '#e6dcc6', guard: 'scroll', guardC: 'gold', emblem: 'sun' }),
  I('sword-g5', 'sword', 'Pomegranate Sword', 30, { blade: '#9b2c2c', grip: '#6b2a22', guard: 'bar', guardC: 'copper', pommel: 'copper', dots: true }),
  I('sword-g6', 'sword', 'Pearl Lotus Sword', 35, { blade: '#f3ece0', grip: '#d4a95a', guard: 'scroll', guardC: 'gold', emblem: 'lotus' }),
  I('sword-x1', 'sword', 'Scroll of the Word', 35, { scroll: true, blade: '#f0e4c6', grip: '#7a4e2c', guard: 'bar', guardC: 'gold' }, { noIcon: true }),

  // BONUS: robes & mantles (outer layer)
  I('outer-joseph', 'outer', 'Joseph\'s Colourful Robe', 60, { kind: 'robe', open: true, stripes: ['#a33b2c', '#d39a3a', '#4f5f95', '#8a9a6b', '#6e4a7a', '#e8dcc4'], len: 'ankle', sleeves: 'long' }, { bonus: true }),
  I('outer-elijah', 'outer', 'Elijah\'s Mantle', 45, { kind: 'mantle', color: '#7a5636', stitch: '#e8dcc4', len: 'calf' }, { bonus: true }),
  I('outer-john', 'outer', 'Camel-Hair Tunic (John)', 45, { kind: 'rough', color: '#a88c68', belt: '#3a2418', len: 'calf', sleeves: 'elbow' }, { bonus: true }),
  I('outer-ephod', 'outer', 'High Priest\'s Ephod', 60, { kind: 'ephod', stripes: ['#2c4a9a', '#6a2f7a', '#b02a2a', '#d4a640', '#efe6d2'] }, { bonus: true }),
  I('outer-priestrobe', 'outer', 'Blue Robe with Bells', 70, { kind: 'robe', color: '#2b4fa8', len: 'ankle', sleeves: 'elbow', bells: true }, { bonus: true }),
  I('outer-lydia', 'outer', 'Lydia\'s Purple Shawl', 40, { kind: 'shawl', color: '#6a3f86', trim: '#d6ae52' }, { bonus: true, noIcon: true }),
  I('outer-fleece', 'outer', 'Shepherd\'s Fleece', 40, { kind: 'fleece', color: '#f1ece0' }, { bonus: true, noIcon: true }),

  // BONUS: headwear (crown sits on top; turban/headscarf replace the helmet)
  I('head-crown', 'head', 'Esther\'s Crown', 60, { kind: 'crown' }, { bonus: true }),
  I('head-turban', 'head', 'Priest\'s Turban', 55, { kind: 'turban', replacesHelmet: true }, { bonus: true }),
  I('head-scarf', 'head', 'Shepherd\'s Headscarf', 35, { kind: 'scarf', color: '#e9e1cf', stripe: '#7a3b2c', replacesHelmet: true }, { bonus: true, noIcon: true }),

  // BONUS: treasures (accessories, one per placement)
  I('acc-breastpiece', 'acc', 'Breastpiece of 12 Stones', 80, { kind: 'breastpiece', place: 'chest' }, { bonus: true }),
  I('acc-signet', 'acc', 'Joseph\'s Signet & Chain', 50, { kind: 'signet', place: 'neck' }, { bonus: true }),
  I('acc-barley', 'acc', 'Ruth\'s Barley Sheaf', 35, { kind: 'barley', place: 'back' }, { bonus: true }),
  I('acc-staff', 'acc', 'Moses\' Staff', 40, { kind: 'staff', place: 'back' }, { bonus: true }),
  I('acc-pouch', 'acc', 'David\'s Shepherd Pouch', 30, { kind: 'pouch', place: 'hipR' }, { bonus: true }),
  I('acc-casket', 'acc', 'Magi Gift Casket', 50, { kind: 'casket', place: 'hipL' }, { bonus: true }),
  I('acc-lyre', 'acc', 'David\'s Lyre', 45, { kind: 'lyre', place: 'back' }, { bonus: true, noIcon: true }),
  I('acc-lamp', 'acc', 'Oil Lamp of the Wise', 35, { kind: 'lamp', place: 'hipL' }, { bonus: true, noIcon: true }),
  I('acc-dove', 'acc', 'Dove of Peace', 40, { kind: 'dove', place: 'shoulder' }, { bonus: true, noIcon: true }),
  I('acc-tambourine', 'acc', 'Miriam\'s Tambourine', 35, { kind: 'tambourine', place: 'hipL' }, { bonus: true, noIcon: true }),
];

export const ITEM_MAP = Object.fromEntries(ITEMS.map((it) => [it.id, it]));

// ---- Runway walks & poses ---------------------------------------------
export const WALKS = [
  { id: 'march', name: 'Steady March', icon: '🥾', price: 0 },
  { id: 'stroll', name: 'Happy Stroll', icon: '🚶', price: 0 },
  { id: 'bounce', name: 'Joyful Bounce', icon: '🎈', price: 15 },
  { id: 'royal', name: 'Royal Glide', icon: '👑', price: 20 },
];

export const POSES = [
  { id: 'standfirm', name: 'Stand Firm', icon: '💪', price: 0 },
  { id: 'shieldup', name: 'Shield Up', icon: '🛡️', price: 0 },
  { id: 'wave', name: 'Friendly Wave', icon: '👋', price: 0 },
  { id: 'swordsky', name: 'Sword to the Sky', icon: '✨', price: 15 },
  { id: 'praise', name: 'Praise Hands', icon: '🙌', price: 15 },
  { id: 'prayer', name: 'Prayer Hands', icon: '🙏', price: 15 },
  { id: 'pointup', name: 'Point to Heaven', icon: '☝️', price: 15 },
  { id: 'bow', name: 'Humble Bow', icon: '🙇', price: 20 },
  { id: 'spin', name: 'Victory Spin', icon: '🌀', price: 20 },
  { id: 'hero', name: 'Hero Stance', icon: '🦸', price: 25 },
  { id: 'kneel', name: 'Faithful Kneel', icon: '🧎', price: 25 },
  { id: 'jump', name: 'Jump for Joy', icon: '🎉', price: 30 },
];
export const POSE_MAP = Object.fromEntries(POSES.map((p) => [p.id, p]));
export const WALK_MAP = Object.fromEntries(WALKS.map((w) => [w.id, w]));
export const MAX_POSES = 3;
export const PRAYER_MAX = 140;

export const PRAYER_STARTERS = [
  'Dear God, help me to ',
  'Thank you Jesus for ',
  'Lord, give me courage to ',
  'Holy Spirit, teach me to ',
  'God, please be with ',
];

// unlock key helpers: items use their id; poses "pose:id"; walks "walk:id"
export const unlockKey = (kind, id) => (kind === 'item' ? id : `${kind}:${id}`);

export function basePrice(kind, id) {
  if (kind === 'item') return ITEM_MAP[id]?.price ?? null;
  if (kind === 'pose') return POSE_MAP[id]?.price ?? null;
  if (kind === 'walk') return WALK_MAP[id]?.price ?? null;
  return null;
}
export function priceFor(kind, id, scale = 1) {
  const p = basePrice(kind, id);
  if (p == null) return null;
  return p === 0 ? 0 : Math.max(1, Math.round(p * scale));
}

export function defaultOutfit(body = 'boy') {
  const girl = body === 'girl';
  return {
    body: girl ? 'girl' : 'boy',
    skin: 3,
    hair: girl ? 'lowbun' : 'crop',
    hairColor: 1,
    tunic: girl ? 'tunic-g1' : 'tunic-v1',
    belt: null, breastplate: null, shoes: null, shield: null, helmet: null, sword: null,
    outer: null, head: null, acc: [],
    prayer: '',
    walk: 'march',
    poses: ['standfirm', 'wave'],
  };
}

export function isOwned(key, owned, unlockAll) {
  if (unlockAll) return true;
  return owned instanceof Set ? owned.has(key) : Array.isArray(owned) ? owned.includes(key) : false;
}

// Validate an outfit (server-side) so locked things can't be worn without unlocking.
export function sanitizeOutfit(o, owned, unlockAll) {
  const d = defaultOutfit(o?.body);
  if (!o || typeof o !== 'object') return d;
  const out = { ...d };
  out.body = o.body === 'girl' ? 'girl' : 'boy';
  out.skin = clampInt(o.skin, 0, SKIN_TONES.length - 1, d.skin);
  out.hairColor = clampInt(o.hairColor, 0, HAIR_COLORS.length - 1, d.hairColor);
  out.hair = HAIR_STYLES.some((h) => h.id === o.hair) ? o.hair : d.hair;
  const okItem = (id, cat) => {
    const it = ITEM_MAP[id];
    if (!it || it.cat !== cat) return false;
    return it.price === 0 || isOwned(id, owned, unlockAll);
  };
  out.tunic = okItem(o.tunic, 'tunic') ? o.tunic : d.tunic;
  for (const s of ARMOR_SLOTS) out[s] = o[s] && okItem(o[s], s) ? o[s] : null;
  out.outer = o.outer && okItem(o.outer, 'outer') ? o.outer : null;
  out.head = o.head && okItem(o.head, 'head') ? o.head : null;
  const places = new Set();
  out.acc = (Array.isArray(o.acc) ? o.acc : []).filter((id) => {
    if (!okItem(id, 'acc')) return false;
    const pl = ITEM_MAP[id].look.place;
    if (places.has(pl)) return false;
    places.add(pl); return true;
  }).slice(0, 6);
  out.prayer = typeof o.prayer === 'string' ? o.prayer.slice(0, PRAYER_MAX) : '';
  const walkOk = WALK_MAP[o.walk] && (WALK_MAP[o.walk].price === 0 || isOwned(`walk:${o.walk}`, owned, unlockAll));
  out.walk = walkOk ? o.walk : 'march';
  out.poses = (Array.isArray(o.poses) ? o.poses : []).filter((p) => POSE_MAP[p] && (POSE_MAP[p].price === 0 || isOwned(`pose:${p}`, owned, unlockAll))).slice(0, MAX_POSES);
  if (!out.poses.length) out.poses = ['standfirm'];
  return out;
}

export function armorCount(outfit) {
  if (!outfit) return 0;
  let n = 0;
  for (const s of ARMOR_SLOTS) {
    if (!outfit[s]) continue;
    if (s === 'helmet' && outfit.head && ITEM_MAP[outfit.head]?.look.replacesHelmet) continue;
    n++;
  }
  return n;
}

function clampInt(v, lo, hi, dflt) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}
