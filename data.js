// Primary archive data. Sources and uncertainty notes are shown in the UI/README.
export const APPLE_ARTIST='https://music.apple.com/us/artist/lucki/589757880';
export const LAST_LAUGH='https://music.apple.com/us/album/last-laugh-archive-tape/6821145872';
export const ERAS=[
 {id:'beginnings',year:'2013—14',start:2013,title:'THE BEGINNING',short:'LUCKI ECK$',tag:'THE FIRST TRANSMISSION',accent:'#c1d8da',projects:['Alternative Trap','Body High'],description:'Raw Chicago experimentation. Under the Lucki Eck$ name, the early tapes carved out an independent sound with clouded production, off-center flows and stripped-back atmospheres.',visual:'ANALOG / 001'},
 {id:'freewave',year:'2015—16',start:2015,title:'FREEWAVE',short:'FREEWAVE',tag:'TAPES FROM THE UNDERGROUND',accent:'#b0b4aa',projects:['X','Freewave','Son of Sam','Freewave 2'],description:'A restless sequence of mixtapes and EPs refined an increasingly recognizable delivery. Freewave became more than a title: it signaled a whole era of experimentation.',visual:'CASSETTE / 002'},
 {id:'watch',year:'2017—18',start:2017,title:'WATCH MY BACK',short:'DAYS B4',tag:'NIGHTS / FRAGMENTS / MEMORY',accent:'#9e506d',projects:['Watch My Back','Days B4 II'],description:'Darker textures, late-night atmosphere and inward-looking writing mark the transition toward a new chapter. Watch My Back and Days B4 II became defining stops.',visual:'NIGHT / 003'},
 {id:'three',year:'2019',start:2019,title:'FREEWAVE 3 / DAYS B4 III',short:'THE 2019 FILES',tag:'TWO MOMENTUM-SHIFTING RELEASES',accent:'#b3493c',projects:['Freewave 3','Days B4 III'],description:'A prolific year, anchored by Freewave 3 and Days B4 III. Signature songs and distinctively hazy production helped these tapes become touchstones for many longtime listeners.',visual:'ARCHIVE / 004'},
 {id:'almost',year:'2020',start:2020,title:'ALMOST THERE',short:'IN TRANSIT',tag:'HEADLIGHTS THROUGH THE FOG',accent:'#739ec8',projects:['Almost There'],description:'Almost There links the intimacy of the earlier mixtapes with a bigger, more expansive presentation. Its cool night-drive atmosphere feels like movement through an unfinished city.',visual:'TRANSIT / 005'},
 {id:'wake',year:'2021',start:2021,title:'WAKE UP LUCKI',short:'WAKE UP',tag:'A SHARP NEW FREQUENCY',accent:'#bd6b72',projects:['WAKE UP LUCKI'],description:'The collaborative project with producer F1lthy brought a different pace and distortion to the catalog, pairing LUCKI’s delivery with a hard-edged electronic landscape.',visual:'FREQUENCY / 006'},
 {id:'flawless',year:'2022',start:2022,title:'FLAWLESS LIKE ME',short:'FLAWLESS',tag:'THE BIGGER PICTURE',accent:'#d7d9d0',projects:['FLAWLESS LIKE ME'],description:'A monumental release in the expanding LUCKI universe, with high-contrast imagery and a more widescreen presentation. The underground identity remained intact even as visibility grew.',visual:'CHROME / 007'},
 {id:'smd',year:'2023',start:2023,title:'S*X M*NEY DR*GS',short:'SMD',tag:'SHADOWS / TEXTURE / CONTRAST',accent:'#a28bb6',projects:['s*x m*ney dr*gs'],description:'Another full-length chapter: dense tones, intimate delivery and sharp fashion-editorial presentation. The visual language shifts, but the unmistakable voice stays central.',visual:'STATIC / 008'},
 {id:'gemini',year:'2024',start:2024,title:'GEMINI!',short:'GEMINI!',tag:'REFLECTIONS / DUALITY',accent:'#9388e5',projects:['GEMINI!'],description:'The idea of duality becomes a fitting visual framework for this era. A high-profile album blends an expanded scope with an individual musical perspective.',visual:'MIRROR / 009'},
 {id:'road',year:'2025—26',start:2025,title:'THE ROAD TO 2026',short:'NEW SIGNALS',tag:'THE NEXT TRANSMISSION',accent:'#93ae84',projects:['DaysB4Bad*','Dr*gs R Bad'],description:'New releases and momentum culminated in 2026’s Dr*gs R Bad. This chapter looks forward even as the archive begins gathering its own history.',visual:'FUTURE / 010'},
 {id:'last',year:'2026',start:2026,title:'LAST LAUGH',short:'THE VAULT',tag:'EVERY ERA LEAVES A TRACE',accent:'#e35145',projects:['Last Laugh (archive tape)'],description:'An archival release that connects the past to the present. Twelve officially released recordings turn an earlier collection of memories into a new point of entry.',visual:'RECOVERED / 011'}
];
// Types reflect common catalog descriptions, not a claim about each platform's categorization.
export const RELEASES=[
 {id:'alternative-trap',title:'Alternative Trap',year:2013,type:'mixtape',era:'beginnings',notes:'A 2013 debut project issued under the Lucki Eck$ name.',color:['#747d73','#131816']},
 {id:'body-high',title:'Body High',year:2014,type:'mixtape',era:'beginnings',notes:'A follow-up early mixtape with a distinctly atmospheric palette.',color:['#8ba0a5','#23303c']},
 {id:'x',title:'X',year:2015,type:'mixtape',era:'freewave',notes:'An early release in the 2015 run of projects.',color:['#b3a38b','#3b3530']},
 {id:'freewave',title:'Freewave',year:2015,type:'ep',era:'freewave',notes:'The 2015 Freewave EP established the title that would return throughout his catalog.',color:['#747d89','#29272b']},
 {id:'son-of-sam',title:'Son of Sam',year:2016,type:'ep',era:'freewave',notes:'A 2016 project from the experimental Freewave period.',color:['#8e9081','#32271f']},
 {id:'freewave-2',title:'Freewave 2',year:2016,type:'mixtape',era:'freewave',notes:'An eleven-track 2016 project.',color:['#7f8290','#211e2e']},
 {id:'watch-my-back',title:'Watch My Back',year:2017,type:'mixtape',era:'watch',notes:'A major 2017 project from the second phase of his career.',color:['#7c3b47','#21141a']},
 {id:'days-b4-ii',title:'Days B4 II',year:2018,type:'ep',era:'watch',notes:'A brief 2018 chapter that prefigured Days B4 III.',color:['#80645c','#1d1b1d']},
 {id:'freewave-3',title:'Freewave 3',year:2019,type:'mixtape',era:'three',notes:'A defining 2019 Freewave installment.',color:['#a44d40','#27211a']},
 {id:'days-b4-iii',title:'Days B4 III',year:2019,type:'mixtape',era:'three',notes:'A landmark 2019 project that includes the tracks Randomly and 4 The Betta.',color:['#7c3c54','#161c1a']},
 {id:'almost-there',title:'Almost There',year:2020,type:'mixtape',era:'almost',notes:'A 2020 mixtape connecting different points in his evolving sound.',color:['#638fb0','#192739']},
 {id:'wake-up-lucki',title:'WAKE UP LUCKI',year:2021,type:'mixtape',era:'wake',notes:'2021 collaborative project by LUCKI and F1lthy.',color:['#8f3944','#221019']},
 {id:'flawless-like-me',title:'FLAWLESS LIKE ME',year:2022,type:'album',era:'flawless',notes:'His 2022 studio album, released through EMPIRE.',color:['#959894','#242626']},
 {id:'smd',title:'s*x m*ney dr*gs',year:2023,type:'album',era:'smd',notes:'2023 studio album; another milestone in a growing discography.',color:['#635074','#161a25']},
 {id:'gemini',title:'GEMINI!',year:2024,type:'album',era:'gemini',notes:'2024 album with a concept well suited to a mirrored visual world.',color:['#6358a5','#151323']},
 {id:'daysb4bad',title:'DaysB4Bad*',year:2026,type:'ep',era:'road',notes:'A 2026 entry in the evolving Days B4 thread.',color:['#5b7469','#151d1c']},
 {id:'drgs-r-bad',title:'Dr*gs R Bad',year:2026,type:'album',era:'road',notes:'A May 2026 project released through Lucki / EMPIRE.',color:['#879b75','#242823']},
 {id:'last-laugh',title:'Last Laugh (archive tape)',year:2026,type:'album',era:'last',notes:'Twelve tracks, 24 minutes; officially released October 16, 2026 via Lucki / EMPIRE.',url:LAST_LAUGH,color:['#ab3830','#230f11']}
];
export const TRACKS=[
 {name:'what it is',duration:'1:57'},
 {name:'all wock',duration:'2:23'},
 {name:'60 mgs',duration:'2:05',context:'Apple Music notes that this track had become a fan favorite by 2022 before its official 2026 streaming release.'},
 {name:'overseas',duration:'2:00'},
 {name:"replica's n capper's",duration:'2:03'},
 {name:'high together',duration:'2:00'},
 {name:'psycho truck',duration:'1:35'},
 {name:'nun like yall',duration:'1:53'},
 {name:'total',duration:'2:09'},
 {name:'okay, copy!',duration:'2:42',context:'Apple Music describes this song as drawing inspiration from early-2000s trap production.'},
 {name:'super brazy',duration:'1:43'},
 {name:'knew what it was',duration:'2:01'}
];
export const SOURCES=[
 {name:'Apple Music: LUCKI',url:APPLE_ARTIST},
 {name:'Apple Music: Last Laugh',url:LAST_LAUGH},
 {name:'MusicBrainz: LUCKI',url:'https://musicbrainz.org/artist/9ccaca30-60aa-4890-ae6c-ab55225ee274'},
 {name:'MusicBrainz release list',url:'https://musicbrainz.org/artist/9ccaca30-60aa-4890-ae6c-ab55225ee274/releases'},
 {name:'AllMusic: LUCKI',url:'https://www.allmusic.com/artist/lucki-mn0003887247'}
];