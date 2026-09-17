export interface CloudStreamRepoDef {
  id: string;
  name: string;
  icon?: string;
  iconUrl?: string;
  iconBg?: string;
  badge: string;
  tags: string[];
  shortcodes?: string[];
  directInstall: string;
  webpage?: string;
  community?: string;
  description: string;
  plugins?: { name: string; featured?: boolean; disabled?: boolean }[];
}

export const ALL_CLOUDSTREAM_REPOSITORIES: CloudStreamRepoDef[] = [
  {
    "id": "nehal",
    "name": "Nehal's Server (BDIX & CloudStream)",
    "icon": "🐧",
    "iconUrl": "https://raw.githubusercontent.com/nehalDIU/nehal-CloudStream/master/icon.png",
    "iconBg": "rgba(99,102,241,0.2)",
    "badge": "BDIX / Fast",
    "tags": [
      "bdix",
      "bangladeshi",
      "fast",
      "english",
      "movies",
      "series",
      "anime"
    ],
    "shortcodes": [
      "nehal",
      "bdix",
      "nehalbdix",
      "ns"
    ],
    "directInstall": "https://raw.githubusercontent.com/nehalDIU/nehal-CloudStream/master/repo.json",
    "webpage": "https://github.com/nehalDIU/nehal-CloudStream",
    "description": "High-speed domestic BDIX gigabit providers, CineplexBD, AllWish, FTP, and domestic streaming servers.",
    "plugins": [
      {
        "name": "CineplexBD",
        "featured": true
      },
      {
        "name": "DiscoveryFTP",
        "featured": true
      },
      {
        "name": "DhakaFlix"
      },
      {
        "name": "CircleFTP"
      },
      {
        "name": "AllWish"
      }
    ]
  },
  {
    "id": "hexated",
    "name": "Hexated Providers",
    "icon": "⭐",
    "iconUrl": "https://github.com/Hexated.png?size=100",
    "iconBg": "rgba(234,179,8,0.2)",
    "badge": "Global / Movies",
    "tags": [
      "global",
      "english",
      "movies",
      "series",
      "official"
    ],
    "shortcodes": [
      "hexated",
      "hex"
    ],
    "directInstall": "https://raw.githubusercontent.com/Hexated/cloudstream-extensions-hexated/builds/plugins.json",
    "webpage": "https://github.com/Hexated/cloudstream-extensions-hexated",
    "description": "Comprehensive global movie, series, and multi-host scraping providers maintained by Hexated.",
    "plugins": [
      {
        "name": "SuperStream",
        "featured": true
      },
      {
        "name": "SoraStream",
        "featured": true
      },
      {
        "name": "StreamPlay"
      }
    ]
  },
  {
    "id": "storm",
    "name": "Stormunblessed (Anime & Media)",
    "icon": "⚡",
    "iconUrl": "https://github.com/Stormunblessed.png?size=100",
    "iconBg": "rgba(59,130,246,0.2)",
    "badge": "Anime / Drama",
    "tags": [
      "anime",
      "asian",
      "drama",
      "english"
    ],
    "shortcodes": [
      "storm",
      "stormunblessed"
    ],
    "directInstall": "https://raw.githubusercontent.com/Stormunblessed/stormunblessed-cs3/master/repo.json",
    "webpage": "https://github.com/Stormunblessed/stormunblessed-cs3",
    "description": "Specialized anime, drama, and light novel media providers with rich metadata extraction.",
    "plugins": [
      {
        "name": "GogoAnime",
        "featured": true
      },
      {
        "name": "Zoro"
      },
      {
        "name": "DramaCool"
      }
    ]
  },
  {
    "id": "cs-multi",
    "name": "CloudStream Multilingual",
    "icon": "🌐",
    "iconUrl": "https://github.com/recloudstream.png?size=100",
    "iconBg": "rgba(16,185,129,0.2)",
    "badge": "Official Multilingual",
    "tags": [
      "multilang",
      "official",
      "french",
      "spanish",
      "arabic",
      "german"
    ],
    "shortcodes": [
      "cs-multi",
      "multilang"
    ],
    "directInstall": "https://raw.githubusercontent.com/recloudstream/cloudstream-extensions-multilingual/master/repo.json",
    "webpage": "https://github.com/recloudstream/cloudstream-extensions-multilingual",
    "description": "Official global repository supporting French, Spanish, German, Hindi, Arabic, and multilingual sources.",
    "plugins": [
      {
        "name": "FrenchStream"
      },
      {
        "name": "AnimeFLV"
      },
      {
        "name": "CineCalidad"
      }
    ]
  },
  {
    "id": "cspr",
    "name": "CloudStream Providers",
    "icon": "☁️",
    "iconUrl": "https://github.com/recloudstream.png?size=100",
    "iconBg": "rgba(108,99,255,0.15)",
    "badge": "Official",
    "tags": [
      "official",
      "english"
    ],
    "shortcodes": [
      "cspr",
      "0094"
    ],
    "directInstall": "https://raw.githubusercontent.com/recloudstream/extensions/master/repo.json",
    "webpage": "https://github.com/recloudstream/extensions",
    "description": "The only official CloudStream repository maintained by the core team.",
    "plugins": [
      {
        "name": "Dailymotion"
      },
      {
        "name": "Invidious",
        "featured": true
      },
      {
        "name": "Twitch"
      }
    ]
  },
  {
    "id": "mega",
    "name": "Mega Repository",
    "icon": "🔥",
    "iconUrl": "https://github.com/self-similarity.png?size=100",
    "iconBg": "rgba(251,113,133,0.15)",
    "badge": "Multi-lang",
    "tags": [
      "multilang",
      "english"
    ],
    "shortcodes": [
      "megarepo",
      "3737"
    ],
    "directInstall": "https://raw.githubusercontent.com/self-similarity/MegaRepo/builds/repo.json",
    "webpage": "https://github.com/self-similarity/MegaRepo/",
    "description": "The 'Mega' plugin aggregates maintained provider repositories for one-click access.",
    "plugins": [
      {
        "name": "Mega",
        "featured": true
      }
    ]
  },
  {
    "id": "phisher",
    "name": "Phisher Repo",
    "icon": "🎬",
    "iconUrl": "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/Icons/RepoIcon.png",
    "iconBg": "rgba(251,191,36,0.15)",
    "badge": "Hindi & Global",
    "tags": [
      "multilang",
      "english",
      "hindi"
    ],
    "shortcodes": [
      "phisherrepo",
      "864"
    ],
    "directInstall": "https://raw.githubusercontent.com/phisher98/cloudstream-extensions-phisher/refs/heads/builds/repo.json",
    "webpage": "https://github.com/phisher98/cloudstream-extensions-phisher",
    "community": "https://discord.gg/",
    "description": "Huge collection of Indian, Hindi, English, and Asian media providers.",
    "plugins": [
      {
        "name": "AllWish"
      },
      {
        "name": "AnimePahe"
      },
      {
        "name": "BanglaPlex"
      },
      {
        "name": "Desicinemas"
      },
      {
        "name": "HDhub4u"
      },
      {
        "name": "HiAnime"
      },
      {
        "name": "Kisskh"
      },
      {
        "name": "MovieBox"
      },
      {
        "name": "StreamPlay",
        "featured": true
      },
      {
        "name": "SuperStream",
        "featured": true
      },
      {
        "name": "Ultima",
        "featured": true
      },
      {
        "name": "Yflix",
        "featured": true
      }
    ]
  },
  {
    "id": "megix",
    "name": "Megix Repo",
    "icon": "🇮🇳",
    "iconUrl": "https://wsrv.nl/?url=https://avatars.githubusercontent.com/u/91174352&mask=circle",
    "iconBg": "rgba(249,115,22,0.15)",
    "badge": "Hindi & English",
    "tags": [
      "hindi",
      "english"
    ],
    "shortcodes": [
      "csx",
      "3670"
    ],
    "directInstall": "https://raw.githubusercontent.com/SaurabhKaperwan/CSX/builds/CS.json",
    "webpage": "https://github.com/SaurabhKaperwan/CSX/",
    "description": "Hindi and English content with a great selection of movie and streaming sources.",
    "plugins": [
      {
        "name": "Bollyflix"
      },
      {
        "name": "CineStream",
        "featured": true
      },
      {
        "name": "GDIndex"
      },
      {
        "name": "MoviesDrive"
      },
      {
        "name": "Moviesmod"
      },
      {
        "name": "NetflixMirror"
      },
      {
        "name": "VegaMovies"
      }
    ]
  },
  {
    "id": "3rabi",
    "name": "3rabi عربي",
    "icon": "🌙",
    "iconUrl": "https://github.com/Abodabodd.png?size=100",
    "iconBg": "rgba(251,191,36,0.12)",
    "badge": "Arabic",
    "tags": [
      "arabic"
    ],
    "shortcodes": [
      "arb",
      "343"
    ],
    "directInstall": "https://raw.githubusercontent.com/Abodabodd/re-3arabi/refs/heads/main/repo",
    "webpage": "https://github.com/Abodabodd/re-3arabi/",
    "description": "Comprehensive Arabic repository with movies, series, anime, and Arab channels.",
    "plugins": [
      {
        "name": "Anime4up"
      },
      {
        "name": "Ohatv"
      },
      {
        "name": "Tuktukcima"
      },
      {
        "name": "Cimawbas"
      },
      {
        "name": "Syrialive"
      },
      {
        "name": "VIU"
      },
      {
        "name": "ArabSeed",
        "featured": true
      },
      {
        "name": "WeCima"
      }
    ]
  },
  {
    "id": "indostream",
    "name": "IndoStream Repo",
    "icon": "🇮🇩",
    "iconUrl": "https://github.com/TeKuma25.png?size=100",
    "iconBg": "rgba(239,68,68,0.15)",
    "badge": "Indonesian",
    "tags": [
      "indonesian",
      "asian"
    ],
    "shortcodes": [
      "id",
      "735"
    ],
    "directInstall": "https://raw.githubusercontent.com/TeKuma25/IndoStream/builds/repo.json",
    "webpage": "https://github.com/TeKuma25/IndoStream",
    "description": "Indonesian providers for movies, dramas, and anime.",
    "plugins": [
      {
        "name": "Anoboy"
      },
      {
        "name": "Idlix"
      },
      {
        "name": "JuraganFilm"
      },
      {
        "name": "Kuramanime"
      },
      {
        "name": "LK21"
      },
      {
        "name": "Nekopoi"
      },
      {
        "name": "Oploverz"
      },
      {
        "name": "Samehadaku",
        "featured": true
      }
    ]
  },
  {
    "id": "extcloud",
    "name": "ExtCloud Repo",
    "icon": "🌦️",
    "iconUrl": "https://github.com/duro92.png?size=100",
    "iconBg": "rgba(59,130,246,0.15)",
    "badge": "Global / Hindi",
    "tags": [
      "english",
      "hindi"
    ],
    "shortcodes": [
      "ext",
      "398"
    ],
    "directInstall": "https://raw.githubusercontent.com/duro92/ExtCloud/refs/heads/builds/repo.json",
    "webpage": "https://github.com/duro92/ExtCloud/",
    "description": "Extended repository with Hindi and international sources.",
    "plugins": [
      {
        "name": "AllWish"
      },
      {
        "name": "Bollyflix"
      },
      {
        "name": "DramaCool"
      },
      {
        "name": "HDhub4u"
      },
      {
        "name": "HiAnime"
      },
      {
        "name": "MoviesDrive"
      },
      {
        "name": "SuperStream",
        "featured": true
      },
      {
        "name": "VegaMovies"
      }
    ]
  },
  {
    "id": "cloudx",
    "name": "CloudX Repository",
    "icon": "⚡",
    "iconUrl": "https://i.ibb.co/q3YkdNRv/asm0d3usx.png",
    "iconBg": "rgba(168,85,247,0.15)",
    "badge": "English",
    "tags": [
      "english"
    ],
    "shortcodes": [
      "cx",
      "29"
    ],
    "directInstall": "https://raw.githubusercontent.com/Asm0d3usX/CloudX/builds/repo.json",
    "webpage": "https://github.com/Asm0d3usX/CloudX",
    "description": "English content providers for movies, TV series, and sports streams.",
    "plugins": [
      {
        "name": "AnimeFlix"
      },
      {
        "name": "FlixWave"
      },
      {
        "name": "MyFlixer"
      },
      {
        "name": "PrimeWire"
      },
      {
        "name": "StreamLord"
      },
      {
        "name": "TopStream",
        "featured": true
      }
    ]
  },
  {
    "id": "dogior",
    "name": "doGior's Had Enough",
    "icon": "🐺",
    "iconUrl": "https://raw.githubusercontent.com/doGior/doGiorsHadEnough/master/repo_icon.png",
    "iconBg": "rgba(244,63,94,0.15)",
    "badge": "English & IPTV",
    "tags": [
      "english",
      "iptv"
    ],
    "shortcodes": [
      "dg",
      "464"
    ],
    "directInstall": "https://raw.githubusercontent.com/doGior/doGiorsHadEnough/refs/heads/builds/repo.json",
    "webpage": "https://github.com/doGior/doGiorsHadEnough",
    "description": "Curated collection of high quality English scrapers and IPTV playlists.",
    "plugins": [
      {
        "name": "Cinezone"
      },
      {
        "name": "Freeview"
      },
      {
        "name": "IPTV-Org",
        "featured": true
      },
      {
        "name": "PlutoTV"
      },
      {
        "name": "SolarMovie"
      },
      {
        "name": "Tubii"
      }
    ]
  },
  {
    "id": "cncverse",
    "name": "CNC Verse Repository",
    "icon": "🌌",
    "iconUrl": "https://raw.githubusercontent.com/NivinCNC/CNCVerse-Cloud-Stream-Extension/refs/heads/builds/cnc.png",
    "iconBg": "rgba(99,102,241,0.15)",
    "badge": "Tamil & Malayalam",
    "tags": [
      "hindi",
      "regional",
      "english"
    ],
    "shortcodes": [
      "cncv",
      "cnc",
      "262"
    ],
    "directInstall": "https://raw.githubusercontent.com/NivinCNC/CNCVerse-Cloud-Stream-Extension/refs/heads/builds/CNC.json",
    "webpage": "https://github.com/NivinCNC/CNCVerse-Cloud-Stream-Extension",
    "description": "South Indian cinema powerhouse: Malayalam, Tamil, Telugu, and Kannada sources.",
    "plugins": [
      {
        "name": "1TamilMV",
        "featured": true
      },
      {
        "name": "Bolly2Tolly"
      },
      {
        "name": "Einthusan",
        "featured": true
      },
      {
        "name": "MalayalamMovies"
      },
      {
        "name": "TamilBlasters"
      },
      {
        "name": "TamilYogi"
      }
    ]
  },
  {
    "id": "diegon",
    "name": "DieGon / ItaliaInStreaming",
    "icon": "🇮🇹",
    "iconUrl": "https://raw.githubusercontent.com/DieGon7771/ItaliaInStreaming/master/repo_icon.png",
    "iconBg": "rgba(34,197,94,0.15)",
    "badge": "Italian",
    "tags": [
      "italian"
    ],
    "shortcodes": [
      "diegon",
      "47"
    ],
    "directInstall": "https://raw.githubusercontent.com/DieGon7771/ItaliaInStreaming/builds/repo.json",
    "webpage": "https://github.com/DieGon7771/ItaliaInStreaming",
    "description": "The primary Italian streaming repository with Italian audio & subtitles.",
    "plugins": [
      {
        "name": "Altadefinizione",
        "featured": true
      },
      {
        "name": "AnimeWorld"
      },
      {
        "name": "CB01",
        "featured": true
      },
      {
        "name": "EuroStreaming"
      },
      {
        "name": "Filmpertutti"
      },
      {
        "name": "StreamingCommunity"
      }
    ]
  },
  {
    "id": "cskarma",
    "name": "Cs-Karma",
    "icon": "⚡",
    "iconUrl": "https://raw.githubusercontent.com/Kraptor123/Cs-Karma/refs/heads/master/.github/logo/cskarma.png",
    "iconBg": "rgba(234,179,8,0.15)",
    "badge": "Turkish & Multi",
    "tags": [
      "turkish",
      "multilang"
    ],
    "shortcodes": [
      "karma",
      "727"
    ],
    "directInstall": "https://raw.githubusercontent.com/Kraptor123/Cs-Karma/refs/heads/master/repo.json",
    "webpage": "https://github.com/Kraptor123/Cs-Karma",
    "description": "Fast multi-source scraping for Turkish series, dramas, and anime.",
    "plugins": [
      {
        "name": "Dizibox"
      },
      {
        "name": "Dizipal",
        "featured": true
      },
      {
        "name": "Diziyo"
      },
      {
        "name": "Filmmodu"
      },
      {
        "name": "FullHDFilm"
      },
      {
        "name": "Hdfilmcehennemi",
        "featured": true
      }
    ]
  },
  {
    "id": "cakestwix",
    "name": "CakesTwix (Ukrainian)",
    "icon": "🇺🇦",
    "iconUrl": "https://raw.githubusercontent.com/CakesTwix/cloudstream-extensions/refs/heads/builds/icon.png",
    "iconBg": "rgba(59,130,246,0.15)",
    "badge": "Ukrainian",
    "tags": [
      "ukrainian"
    ],
    "shortcodes": [
      "cakes",
      "cake",
      "825"
    ],
    "directInstall": "https://raw.githubusercontent.com/CakesTwix/cloudstream-extensions-uk/master/repo.json",
    "webpage": "https://github.com/CakesTwix/cloudstream-extensions-uk",
    "description": "Ukrainian provider extensions with Ukrainian voiceovers and subtitles.",
    "plugins": [
      {
        "name": "BandaFM"
      },
      {
        "name": "EnotTV"
      },
      {
        "name": "FilmUa"
      },
      {
        "name": "Hidlix"
      },
      {
        "name": "SweetTV"
      },
      {
        "name": "UAKino",
        "featured": true
      }
    ]
  },
  {
    "id": "sarapcanagii",
    "name": "DiziPal & TabiiSpor",
    "icon": "🇹🇷",
    "iconUrl": "https://github.com/sarapcanagii.png?size=100",
    "iconBg": "rgba(239,68,68,0.15)",
    "badge": "Turkish Sports",
    "tags": [
      "turkish",
      "iptv"
    ],
    "shortcodes": [
      "sarap",
      "777"
    ],
    "directInstall": "https://raw.githubusercontent.com/sarapcanagii/cs-pluginler/refs/heads/master/repo.json",
    "webpage": "https://github.com/sarapcanagii/cs-pluginler",
    "description": "Specialized Turkish sports IPTV and Turkish series streaming.",
    "plugins": [
      {
        "name": "DiziPal"
      },
      {
        "name": "Selcuksports",
        "featured": true
      },
      {
        "name": "TabiiSpor"
      },
      {
        "name": "Taraftarium"
      }
    ]
  },
  {
    "id": "lawlietrepo",
    "name": "Lawliet Repo",
    "icon": "🇧🇷",
    "iconUrl": "https://github.com/lawlietbr.png?size=100",
    "iconBg": "rgba(16,185,129,0.15)",
    "badge": "Portuguese / Latino",
    "tags": [
      "portuguese",
      "spanish"
    ],
    "shortcodes": [
      "lawliet",
      "529"
    ],
    "directInstall": "https://raw.githubusercontent.com/lawlietbr/lietrepo/refs/heads/main/builds/repo.json",
    "webpage": "https://github.com/lawlietbr/lietrepo",
    "description": "Portuguese and Brazilian repository for dubbed and subtitled anime & movies.",
    "plugins": [
      {
        "name": "AnimesOnlineCC"
      },
      {
        "name": "BetterAnime"
      },
      {
        "name": "CineVision"
      },
      {
        "name": "MegaFilmesHD",
        "featured": true
      },
      {
        "name": "OverFlix"
      },
      {
        "name": "RedeCanais",
        "featured": true
      }
    ]
  },
  {
    "id": "king",
    "name": "King Repository",
    "icon": "👑",
    "iconUrl": "https://github.com/KingLucius.png?size=100",
    "iconBg": "rgba(234,179,8,0.15)",
    "badge": "Multi-Language",
    "tags": [
      "multilang",
      "english"
    ],
    "shortcodes": [
      "kingl",
      "king",
      "846"
    ],
    "directInstall": "https://pastebin.com/raw/Cd2g2tfz",
    "webpage": "https://github.com/KingLucius/cs-extensions",
    "description": "Diverse selection of international anime and movie sources.",
    "plugins": [
      {
        "name": "Animedao"
      },
      {
        "name": "AnimeHeaven"
      },
      {
        "name": "Cineb"
      },
      {
        "name": "LookMovie"
      },
      {
        "name": "VidCloud",
        "featured": true
      },
      {
        "name": "WatchSeries"
      }
    ]
  },
  {
    "id": "italianprovider",
    "name": "Italian Providers",
    "icon": "🇮🇹",
    "iconUrl": "https://github.com/Gian-Fr.png?size=100",
    "iconBg": "rgba(34,197,94,0.15)",
    "badge": "Italian",
    "tags": [
      "italian"
    ],
    "shortcodes": [
      "ipr",
      "ita",
      "482"
    ],
    "directInstall": "https://raw.githubusercontent.com/Gian-Fr/ItalianProvider/builds/repo.json",
    "webpage": "https://github.com/Gian-Fr/ItalianProvider",
    "description": "Curated Italian streaming extensions with anime and series support.",
    "plugins": [
      {
        "name": "AnimeSaturn",
        "featured": true
      },
      {
        "name": "AnimeUnity"
      },
      {
        "name": "CineBlog01"
      },
      {
        "name": "GuardaSerie"
      },
      {
        "name": "Tantifilm"
      }
    ]
  },
  {
    "id": "netmirror",
    "name": "Netmirror Repo",
    "icon": "🪞",
    "iconUrl": "https://github.com/Sushan64.png?size=100",
    "iconBg": "rgba(168,85,247,0.15)",
    "badge": "Netflix Clones",
    "tags": [
      "english",
      "hindi"
    ],
    "shortcodes": [
      "netmirror",
      "638"
    ],
    "directInstall": "https://raw.githubusercontent.com/Sushan64/NetMirror-Extension/refs/heads/builds/Netflix.json",
    "webpage": "https://github.com/Sushan64/NetMirror-Extension",
    "description": "Direct mirrors of popular video-on-demand services with rapid stream links.",
    "plugins": [
      {
        "name": "NetMirror VOD",
        "featured": true
      },
      {
        "name": "PrimeMirror"
      },
      {
        "name": "StreamFlix"
      }
    ]
  },
  {
    "id": "redowan",
    "name": "Redowan's BDIX Repository",
    "icon": "🇧🇩",
    "iconUrl": "https://github.com/redowan99.png?size=100",
    "iconBg": "rgba(16,185,129,0.15)",
    "badge": "BDIX / Bangladesh",
    "tags": [
      "bdix",
      "bangladeshi"
    ],
    "shortcodes": [
      "redowan",
      "733"
    ],
    "directInstall": "https://raw.githubusercontent.com/redowan99/Redowan-CloudStream/master/repo.json",
    "webpage": "https://github.com/redowan99/Redowan-CloudStream",
    "description": "Bangladesh domestic gigabit BDIX FTP servers and Live TV streaming.",
    "plugins": [
      {
        "name": "BDIX Live TV",
        "featured": true
      },
      {
        "name": "BDIX CircleFTP",
        "featured": true
      },
      {
        "name": "DhakaFlix"
      },
      {
        "name": "NaturalBD"
      },
      {
        "name": "SamOnline"
      }
    ]
  },
  {
    "id": "saimuel",
    "name": "Saimuel Repo",
    "icon": "💖",
    "iconUrl": "https://raw.githubusercontent.com/saimuelbr/sweettheartt/refs/heads/main/RepoIcon.png",
    "iconBg": "rgba(244,63,94,0.15)",
    "badge": "Portuguese",
    "tags": [
      "portuguese"
    ],
    "shortcodes": [
      "saim",
      "saimuel",
      "724"
    ],
    "directInstall": "https://raw.githubusercontent.com/saimuelbr/saimuelrepo/refs/heads/main/builds/repo.json",
    "webpage": "https://github.com/saimuelbr/saimuelrepo",
    "description": "Brazilian and Portuguese providers for movies, anime, and dubbed telenovelas.",
    "plugins": [
      {
        "name": "AnimesOnline"
      },
      {
        "name": "CineTop"
      },
      {
        "name": "MegaFilmes",
        "featured": true
      },
      {
        "name": "PobreFlix"
      },
      {
        "name": "TopFlix"
      }
    ]
  },
  {
    "id": "cuxplug",
    "name": "CuxPlug",
    "icon": "🔌",
    "iconUrl": "https://github.com/ycngmn.png?size=100",
    "iconBg": "rgba(59,130,246,0.15)",
    "badge": "Turkish",
    "tags": [
      "turkish"
    ],
    "shortcodes": [
      "cux",
      "289"
    ],
    "directInstall": "https://raw.githubusercontent.com/ycngmn/CuxPlug/builds/repo.json",
    "webpage": "https://github.com/ycngmn/CuxPlug",
    "description": "Fast Turkish TV series and film provider collection.",
    "plugins": [
      {
        "name": "DiziMom"
      },
      {
        "name": "Filmizlesene"
      },
      {
        "name": "KralDizi"
      },
      {
        "name": "YabanciDizi",
        "featured": true
      }
    ]
  },
  {
    "id": "vietnamese",
    "name": "CloudStream Vietnamese",
    "icon": "🇻🇳",
    "iconUrl": "https://raw.githubusercontent.com/recloudstream/cloudstream-extensions-multilingual/master/icons/vi.png",
    "iconBg": "rgba(239,68,68,0.15)",
    "badge": "Vietnamese",
    "tags": [
      "vietnamese",
      "asian"
    ],
    "shortcodes": [
      "viet",
      "vn",
      "843"
    ],
    "directInstall": "https://gitlab.com/tearrs/cloudstream-vietnamese/-/raw/main/repo.json",
    "webpage": "https://gitlab.com/tearrs/cloudstream-vietnamese",
    "description": "Vietnamese movie and drama providers with Vietsub streams.",
    "plugins": [
      {
        "name": "Dongphym"
      },
      {
        "name": "Motphim"
      },
      {
        "name": "Phimmoi",
        "featured": true
      },
      {
        "name": "SubNhanh"
      }
    ]
  },
  {
    "id": "turkish",
    "name": "Turkish Providers | @kraptor123",
    "icon": "🇹🇷",
    "iconUrl": "https://github.com/Kraptor123.png?size=100",
    "iconBg": "rgba(239,68,68,0.15)",
    "badge": "Turkish",
    "tags": [
      "turkish"
    ],
    "shortcodes": [
      "kraptor",
      "572"
    ],
    "directInstall": "https://raw.githubusercontent.com/Kraptor123/cloudstream-extensions-turkish/builds/repo.json",
    "webpage": "https://github.com/Kraptor123/cloudstream-extensions-turkish",
    "description": "Maintained Turkish providers by Kraptor123 for movies and anime.",
    "plugins": [
      {
        "name": "AnimeTR"
      },
      {
        "name": "Dizibox"
      },
      {
        "name": "Dizigom",
        "featured": true
      },
      {
        "name": "FilmModu"
      }
    ]
  },
  {
    "id": "german",
    "name": "German Providers Repository",
    "icon": "🇩🇪",
    "iconUrl": "https://github.com/Bnyro.png?size=100",
    "iconBg": "rgba(234,179,8,0.15)",
    "badge": "German",
    "tags": [
      "german"
    ],
    "shortcodes": [
      "gpr",
      "german",
      "437"
    ],
    "directInstall": "https://raw.githubusercontent.com/Bnyro/GermanProviders/refs/heads/master/repo.json",
    "webpage": "https://github.com/Bnyro/GermanProviders",
    "description": "German providers with German dubbing, German subtitles, and Vavoo live TV.",
    "plugins": [
      {
        "name": "AniWorld"
      },
      {
        "name": "Filmpalast"
      },
      {
        "name": "KinoX",
        "featured": true
      },
      {
        "name": "SerienStream"
      },
      {
        "name": "Vavoo Live",
        "featured": true
      }
    ]
  },
  {
    "id": "luna712",
    "name": "Luna712 Extensions",
    "icon": "🌙",
    "iconUrl": "https://github.com/Luna712.png?size=100",
    "iconBg": "rgba(168,85,247,0.15)",
    "badge": "Anime & Manga",
    "tags": [
      "anime",
      "english"
    ],
    "shortcodes": [
      "luna",
      "586"
    ],
    "directInstall": "https://raw.githubusercontent.com/Luna712/Luna712-CloudStream-Extensions/28885d17ceb7f24782b732b6056085c14c1fd027/repo.json",
    "webpage": "https://github.com/Luna712/Luna712-CloudStream-Extensions",
    "description": "Anime streaming scrapers with multi-audio selection.",
    "plugins": [
      {
        "name": "AllAnime",
        "featured": true
      },
      {
        "name": "AnimeFrenzy"
      },
      {
        "name": "AnimeOnsen"
      },
      {
        "name": "Marin"
      }
    ]
  },
  {
    "id": "zzikozz",
    "name": "zzikozz / French Repo",
    "icon": "🇫🇷",
    "iconUrl": "https://github.com/zzikozz.png?size=100",
    "iconBg": "rgba(59,130,246,0.15)",
    "badge": "French",
    "tags": [
      "french"
    ],
    "shortcodes": [
      "zzikozz",
      "994"
    ],
    "directInstall": "https://raw.githubusercontent.com/zzikozz/frenchCS/refs/heads/main/repo.json",
    "webpage": "https://github.com/zzikozz/frenchCS",
    "description": "French scrapers for movies, anime, and VF/VOSTFR TV series.",
    "plugins": [
      {
        "name": "EmpireStreaming"
      },
      {
        "name": "French-Stream",
        "featured": true
      },
      {
        "name": "VostFree"
      },
      {
        "name": "Wiflix",
        "featured": true
      }
    ]
  },
  {
    "id": "gramflix",
    "name": "GramFlix / French Repo",
    "icon": "🥐",
    "iconUrl": "https://raw.githubusercontent.com/tOntOnbOuLii/GramFlix/main/logo_gf.png",
    "iconBg": "rgba(124,58,237,0.15)",
    "badge": "French",
    "tags": [
      "french"
    ],
    "shortcodes": [
      "gramflix",
      "472"
    ],
    "directInstall": "https://raw.githubusercontent.com/tOntOnbOuLii/GramFlix/main/repo.json",
    "webpage": "https://github.com/tOntOnbOuLii/GramFlix",
    "description": "GramFlix French streaming repository with high definition VF streams.",
    "plugins": [
      {
        "name": "Cineiz"
      },
      {
        "name": "Cpasmieux"
      },
      {
        "name": "DarkiWorld",
        "featured": true
      },
      {
        "name": "GramFlix Core",
        "featured": true
      },
      {
        "name": "Zone-Telechargement"
      }
    ]
  }
];
