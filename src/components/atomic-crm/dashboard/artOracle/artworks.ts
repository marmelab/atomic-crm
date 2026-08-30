export type Artwork = {
  id: string;
  title: string;
  artist_or_maker: string;
  culture_or_region: string;
  date: string;
  medium: string;
  museum: string;
  image_url: string;
  source_url: string;
  tags: string[];
};

// A curated, verified set of open-access museum artworks. Deliberately
// spans regions, media, and eras rather than the old CRM template's small,
// Europe-heavy, single-medium collection — see the Dashboard/Today slice
// report for the sourcing method and why this set is ~20 works rather than
// the ~24-40 aimed for (each image_url below was checked to actually load
// before being added; the Art Institute of Chicago's CDN was avoided per
// prior known delivery failures there).
//
// All works are public domain / CC0 per their source museum's open access
// program: The Metropolitan Museum of Art (Open Access, CC0) and the
// Cleveland Museum of Art (Open Access, CC0).
export const artworks: Artwork[] = [
  {
    id: "cma-1938.6",
    title: "Ancestral Commemorative Head (Uhunmwun-Elao)",
    artist_or_maker:
      "Ẹdo peoples, members of the Igun Eronmwon (royal brasscasters) guild",
    culture_or_region: "Nigeria, Benin Kingdom (West Africa)",
    date: "possibly mid-1500s or early 1600s",
    medium: "Copper alloy and iron",
    museum: "Cleveland Museum of Art",
    image_url: "https://openaccess-cdn.clevelandart.org/1938.6/1938.6_web.jpg",
    source_url: "https://clevelandart.org/art/1938.6",
    tags: ["sculpture", "Africa", "ancestral"],
  },
  {
    id: "cma-1935.304",
    title: "Mask (Bwoom)",
    artist_or_maker: "Kuba-style carver",
    culture_or_region: "Democratic Republic of Congo, Central Africa",
    date: "mid- to late 1800s",
    medium: "Wood and paint",
    museum: "Cleveland Museum of Art",
    image_url:
      "https://openaccess-cdn.clevelandart.org/1935.304/1935.304_web.jpg",
    source_url: "https://clevelandart.org/art/1935.304",
    tags: ["mask", "Africa"],
  },
  {
    id: "cma-2010.442",
    title: "Power Figure (Nkisi)",
    artist_or_maker: "Kongo people",
    culture_or_region: "Republic of the Congo, Central Africa",
    date: "late 1800s–early 1900s",
    medium:
      "Wood, organic materials (including resin), iron, reed, tooth, seashell or glass beads",
    museum: "Cleveland Museum of Art",
    image_url:
      "https://openaccess-cdn.clevelandart.org/2010.442/2010.442_web.jpg",
    source_url: "https://clevelandart.org/art/2010.442",
    tags: ["sculpture", "ritual object", "Africa"],
  },
  {
    id: "cma-2024.73",
    title: "Woman's Shawl or Head Covering",
    artist_or_maker: "Hausa or Dyula-style makers",
    culture_or_region: "Côte d'Ivoire, West Africa",
    date: "1900–1925",
    medium: "Cotton, silk, indigo and other natural dyes",
    museum: "Cleveland Museum of Art",
    image_url:
      "https://openaccess-cdn.clevelandart.org/2024.73/2024.73_web.jpg",
    source_url: "https://clevelandart.org/art/2024.73",
    tags: ["textile", "Africa"],
  },
  {
    id: "met-55176",
    title: "Print (Actor Portrait)",
    artist_or_maker: "Tsuneshige",
    culture_or_region: "Japan",
    date: "ca. 1900 (Meiji period)",
    medium: "Woodblock print; ink and color on paper",
    museum: "The Metropolitan Museum of Art",
    image_url:
      "https://images.metmuseum.org/CRDImages/as/web-large/DP143854.jpg",
    source_url: "https://www.metmuseum.org/art/collection/search/55176",
    tags: ["print", "Asia"],
  },
  {
    id: "met-456949",
    title: "Great Indian Fruit Bat",
    artist_or_maker: "Bhawani Das",
    culture_or_region: "India (Mughal court)",
    date: "ca. 1777–82",
    medium: "Pencil, ink, and opaque watercolor on paper",
    museum: "The Metropolitan Museum of Art",
    image_url:
      "https://images.metmuseum.org/CRDImages/is/web-large/DP167067.jpg",
    source_url: "https://www.metmuseum.org/art/collection/search/456949",
    tags: ["painting", "Asia", "natural history"],
  },
  {
    id: "met-199404",
    title: "Ewer from Burghley House, Lincolnshire",
    artist_or_maker: "Unknown (Chinese porcelain, British silver mounts)",
    culture_or_region: "China (porcelain), Britain (mounts)",
    date: "Chinese porcelain 1573–ca. 1585; British mounts ca. 1585",
    medium: "Hard-paste porcelain, gilded silver",
    museum: "The Metropolitan Museum of Art",
    image_url: "https://images.metmuseum.org/CRDImages/es/web-large/DT568.jpg",
    source_url: "https://www.metmuseum.org/art/collection/search/199404",
    tags: ["ceramics", "decorative arts", "Asia"],
  },
  {
    id: "met-307599",
    title: "Eagle Relief",
    artist_or_maker: "Toltec artist(s)",
    culture_or_region: "Mexico (Toltec)",
    date: "900–1200 CE",
    medium: "Andesite or dacite, Maya blue, stucco, red pigment",
    museum: "The Metropolitan Museum of Art",
    image_url:
      "https://images.metmuseum.org/CRDImages/ao/web-large/DP-20487-001.jpg",
    source_url: "https://www.metmuseum.org/art/collection/search/307599",
    tags: ["sculpture", "Indigenous Americas", "ancient"],
  },
  {
    id: "met-310542",
    title: "Whistling Vessel",
    artist_or_maker: "Maya artist(s)",
    culture_or_region: "Mesoamerica (Maya)",
    date: "400–500 CE",
    medium: "Ceramic",
    museum: "The Metropolitan Museum of Art",
    image_url:
      "https://images.metmuseum.org/CRDImages/ao/web-large/DP-23468-001.jpg",
    source_url: "https://www.metmuseum.org/art/collection/search/310542",
    tags: ["ceramics", "Indigenous Americas", "ancient"],
  },
  {
    id: "met-307827",
    title: "Wearing Blanket",
    artist_or_maker: "Navajo weaver",
    culture_or_region: "Southwestern United States (Navajo/Diné)",
    date: "1865–75",
    medium: "Wool",
    museum: "The Metropolitan Museum of Art",
    image_url:
      "https://images.metmuseum.org/CRDImages/ao/web-large/DP258275.jpg",
    source_url: "https://www.metmuseum.org/art/collection/search/307827",
    tags: ["textile", "Indigenous Americas"],
  },
  {
    id: "met-313153",
    title: "Tunic with Felines",
    artist_or_maker: "Chimú artist(s)",
    culture_or_region: "Peru (Chimú)",
    date: "1450–1550",
    medium: "Cotton, camelid hair",
    museum: "The Metropolitan Museum of Art",
    image_url:
      "https://images.metmuseum.org/CRDImages/ao/web-large/DP-39316-001.jpg",
    source_url: "https://www.metmuseum.org/art/collection/search/313153",
    tags: ["textile", "Indigenous Americas", "Latin America"],
  },
  {
    id: "met-448938",
    title: "“The Funeral of Isfandiyar,” Folio from a Shahnama (Book of Kings)",
    artist_or_maker: "Abu'l Qasim Firdausi (text); unknown painter",
    culture_or_region: "Iran (Persia)",
    date: "1330s",
    medium: "Ink, opaque watercolor, and gold on paper",
    museum: "The Metropolitan Museum of Art",
    image_url:
      "https://images.metmuseum.org/CRDImages/is/web-large/DP238058.jpg",
    source_url: "https://www.metmuseum.org/art/collection/search/448938",
    tags: ["manuscript", "Middle East", "Islamic art"],
  },
  {
    id: "met-447015",
    title: "Tile Panel",
    artist_or_maker: "Unknown",
    culture_or_region: "Ottoman Turkey (Iznik)",
    date: "second half 16th century",
    medium: "Stonepaste; polychrome painted under transparent glaze",
    museum: "The Metropolitan Museum of Art",
    image_url:
      "https://images.metmuseum.org/CRDImages/is/web-large/LC-17_190_2085.jpg",
    source_url: "https://www.metmuseum.org/art/collection/search/447015",
    tags: ["ceramics", "decorative arts", "Middle East", "Islamic art"],
  },
  {
    id: "cma-1969.107",
    title: "Neck Pendant (Hei-tiki)",
    artist_or_maker: "Māori maker",
    culture_or_region: "New Zealand (Māori), Polynesia",
    date: "1800s",
    medium: "Greenstone (pounamu)",
    museum: "Cleveland Museum of Art",
    image_url:
      "https://openaccess-cdn.clevelandart.org/1969.107/1969.107_web.jpg",
    source_url: "https://clevelandart.org/art/1969.107",
    tags: ["jewelry", "Oceania"],
  },
  {
    id: "cma-1971.148",
    title: "Tapa Cloth",
    artist_or_maker: "Unknown",
    culture_or_region: "Fiji Islands, Melanesia",
    date: "before 1971",
    medium: "Mulberry bark (Broussonetia papyrifera)",
    museum: "Cleveland Museum of Art",
    image_url:
      "https://openaccess-cdn.clevelandart.org/1971.148/1971.148_web.jpg",
    source_url: "https://clevelandart.org/art/1971.148",
    tags: ["textile", "Oceania"],
  },
  {
    id: "cma-1982.113",
    title: "Kangaroo",
    artist_or_maker: "Unknown Aboriginal artist",
    culture_or_region: "Western Arnhem Land, Australia",
    date: "1900s",
    medium: "Tempera on bark",
    museum: "Cleveland Museum of Art",
    image_url:
      "https://openaccess-cdn.clevelandart.org/1982.113/1982.113_web.jpg",
    source_url: "https://clevelandart.org/art/1982.113",
    tags: ["painting", "Oceania"],
  },
  {
    id: "met-243808",
    title: "Faience Band Ring",
    artist_or_maker: "Unknown",
    culture_or_region: "Egypt",
    date: "1060–900 BCE (Third Intermediate Period)",
    medium: "Faience",
    museum: "The Metropolitan Museum of Art",
    image_url:
      "https://images.metmuseum.org/CRDImages/gr/web-large/DP121846.jpg",
    source_url: "https://www.metmuseum.org/art/collection/search/243808",
    tags: ["jewelry", "Africa", "ancient"],
  },
  {
    id: "met-255154",
    title: "Terracotta Amphora (Jar)",
    artist_or_maker: "Andokides",
    culture_or_region: "Greece (Attic)",
    date: "ca. 530 BCE",
    medium: "Terracotta",
    museum: "The Metropolitan Museum of Art",
    image_url:
      "https://images.metmuseum.org/CRDImages/gr/web-large/DP116936.jpg",
    source_url: "https://www.metmuseum.org/art/collection/search/255154",
    tags: ["ceramics", "Europe", "ancient"],
  },
  {
    id: "met-247173",
    title: "Marble Statue of Eirene (Personification of Peace)",
    artist_or_maker: "Roman copy after Kephisodotos",
    culture_or_region: "Rome (after a Greek original)",
    date: "ca. 14–68 CE",
    medium: "Marble",
    museum: "The Metropolitan Museum of Art",
    image_url:
      "https://images.metmuseum.org/CRDImages/gr/web-large/DT11659.jpg",
    source_url: "https://www.metmuseum.org/art/collection/search/247173",
    tags: ["sculpture", "Europe", "ancient"],
  },
  {
    id: "met-687677",
    title: "Minnehaha",
    artist_or_maker: "Edmonia Lewis",
    culture_or_region: "United States",
    date: "1868",
    medium: "Marble",
    museum: "The Metropolitan Museum of Art",
    image_url:
      "https://images.metmuseum.org/CRDImages/ad/web-large/DP371841.jpg",
    source_url: "https://www.metmuseum.org/art/collection/search/687677",
    tags: ["sculpture", "North America"],
  },
];
