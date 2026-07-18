// lib/curriculum-full-elaborations.js
// Structured BC Ministry curriculum data: Big Ideas, Content topics, and
// Elaborations (the Ministry's own explanatory notes + sample inquiry
// questions from the official "PDF with Elaborations" documents at
// curriculum.gov.bc.ca), for K-9. Built 2026-07-17 at Aj's request to
// surface the full elaborations content (not just curated activity ideas
// like lib/la-elaborations.js) as a browsable/teachable resource.
//
// Covers all 9 K-9 subject areas: English Language Arts, Mathematics,
// Science, Social Studies, Applied Design/Skills/Technologies, Arts
// Education, Physical Education, Health & Career Education, and French
// (Core French begins at Grade 5 in BC - no K-4 French curriculum exists).
//
// Not yet covered: Francais langue premiere, FRAL (French immersion), and
// the individual non-French Languages courses (German, Japanese, ASL,
// Italian, Korean, Mandarin, Punjabi, Spanish) - these use a different
// per-language page structure on curriculum.gov.bc.ca and were deferred.
//
// Correction note (2026-07-17): an earlier commit of this file only
// contained English Language Arts due to a silent tool failure while
// adding Mathematics/Science - this version fixes that and adds the
// remaining 6 subjects.
//
// Shape: CURRICULUM_ELABORATIONS[subjectName][grade] = {
//   bigIdeas: string[],       // the grade's official Big Ideas
//   content: string[],        // the grade's official Content topic list
//   elaborations: {term, detail}[]  // Ministry elaboration notes / sample
//                                     inquiry questions, usable as concrete
//                                     classroom activity prompts
// }

export const CURRICULUM_ELABORATIONS = {
  "English Language Arts": {
    "K": {
      "bigIdeas": [
        "Language and story can be a source of creativity and joy.",
        "Stories and other texts help us learn about ourselves and our families.",
        "Stories and other texts can be shared through pictures and words.",
        "Everyone has a unique story to share.",
        "Through listening and speaking, we connect with others and share our world.",
        "Playing with language helps us discover how language works.",
        "Curiosity and wonder lead us to new discoveries about ourselves and the world around us."
      ],
      "content": [
        "structure of story",
        "literary elements and devices",
        "reading strategies",
        "oral language strategies",
        "metacognitive strategies",
        "writing processes",
        "concepts of print",
        "letter knowledge",
        "phonemic and phonological awareness",
        "letter formation",
        "the relationship between reading, writing, and oral language"
      ],
      "elaborations": [
        {
          "term": "story/stories",
          "detail": "Narrative texts, real or imagined, that teach us about human nature, motivation, and experience, and often reflect a personal journey or strengthen identity. Can be oral, written, or visual; used to instruct, inspire, entertain."
        },
        {
          "term": "text/texts",
          "detail": "Generic term for oral (speeches, poems, plays, oral stories), written (novels, articles, short stories), visual (posters, photographs), and digital communication."
        },
        {
          "term": "structure of story",
          "detail": "Beginning, middle, end (or first, then, last)."
        },
        {
          "term": "foundational concepts of print",
          "detail": "Directionality of print, difference between letter and word, difference between writing and drawing, spacing, letter-sound relationship, that pictures convey meaning, taking turns, role-playing."
        },
        {
          "term": "oral storytelling processes",
          "detail": "Creating an original story or finding an existing story (with permission), sharing from memory, using vocal expression to clarify meaning."
        },
        {
          "term": "concepts of print (detailed)",
          "detail": "Symbolic nature of writing; correspondence of spoken to printed words; association of letters and sounds; distinctive features of letters/words; uppercase/lowercase correspondence; left-to-right directionality; use of space for word boundaries; punctuation signs; front/back of a book."
        },
        {
          "term": "phonemic and phonological awareness",
          "detail": "Phonemic: segmenting spoken words into phonemes (c/a/t) and blending phonemes into words. Phonological: hearing/creating rhymes, segmenting speech into words, hearing syllables as chunks."
        },
        {
          "term": "letter formation",
          "detail": "Use of scribble writing or letter strings to communicate meaning; distinguishes drawing from writing."
        }
      ]
    },
    "1": {
      "bigIdeas": [
        "Language and story can be a source of creativity and joy.",
        "Stories and other texts help us learn about ourselves and our families.",
        "Stories and other texts can be shared through pictures and words.",
        "Everyone has a unique story to share.",
        "Through listening and speaking, we connect with others and share our world.",
        "Playing with language helps us discover how language works.",
        "Curiosity and wonder lead us to new discoveries about ourselves and the world around us."
      ],
      "content": [
        "elements of story",
        "literary elements and devices",
        "vocabulary to talk about texts",
        "reading strategies",
        "oral language strategies",
        "metacognitive strategies",
        "writing processes",
        "concepts of print",
        "print awareness",
        "phonemic and phonological awareness",
        "letter formation",
        "sentence structure",
        "conventions"
      ],
      "elaborations": [
        {
          "term": "read fluently at grade level",
          "detail": "Reading with comprehension, phrasing, and attention to punctuation."
        },
        {
          "term": "elements of story",
          "detail": "Setting, character, events (few details)."
        },
        {
          "term": "literary elements and devices",
          "detail": "Poetic language, figurative language, sound play, images, colour, symbols."
        },
        {
          "term": "vocabulary to talk about texts",
          "detail": "Book, page, chapter, author, title, illustrator, pictures, web page, website, search box."
        },
        {
          "term": "story in First Peoples cultures",
          "detail": "Traditional/contemporary forms (prose, song, dance, poetry, theatre, carvings) for teaching, sharing creation stories, recording histories, mapping geography, cultural continuity, healing, entertainment."
        },
        {
          "term": "conventions of Canadian spelling, grammar, punctuation",
          "detail": "Capitals/small letters printed legibly; familiar words spelled correctly; correct use of periods, question marks, capitals (including I)."
        },
        {
          "term": "communication forms",
          "detail": "Lists, journals, notes, simple stories, digital/oral presentations, pictures, drama (puppet shows, dance, plays, storyboards)."
        }
      ]
    },
    "2": {
      "bigIdeas": [
        "Language and story can be a source of creativity and joy.",
        "Stories and other texts connect us to ourselves, our families, and our communities.",
        "Everyone has a unique story to share.",
        "Through listening and speaking, we connect with others and share our world.",
        "Playing with language helps us discover how language works.",
        "Curiosity and wonder lead us to new discoveries about ourselves and the world around us."
      ],
      "content": [
        "elements of story",
        "literary elements and devices",
        "text features",
        "vocabulary associated with texts",
        "reading strategies",
        "oral language strategies",
        "metacognitive strategies",
        "writing processes",
        "features of oral language",
        "word patterns, word families",
        "letter formation",
        "sentence structure",
        "conventions"
      ],
      "elaborations": [
        {
          "term": "elements of story",
          "detail": "Character, plot, setting, structure (beginning, middle, end), and dialogue."
        },
        {
          "term": "text features",
          "detail": "How text and visuals are displayed (colour, arrangement, bold, underline)."
        },
        {
          "term": "vocabulary associated with texts",
          "detail": "Book, page, chapter, author, title, illustrator, web page, website, search box, headings, table of contents, pictures, diagrams."
        },
        {
          "term": "text structures",
          "detail": "Letters, recipes, maps, lists, web pages."
        },
        {
          "term": "features of oral language",
          "detail": "Tone, volume, inflection, pace, gestures."
        },
        {
          "term": "sentence structure",
          "detail": "The structure of compound sentences."
        }
      ]
    },
    "3": {
      "bigIdeas": [
        "Language and story can be a source of creativity and joy.",
        "Stories and other texts help us learn about ourselves, our families, and our communities.",
        "Stories can be understood from different perspectives.",
        "Using language in creative and playful ways helps us understand how language works.",
        "Curiosity and wonder lead us to new discoveries about ourselves and the world around us."
      ],
      "content": [
        "elements of story",
        "functions and genres of stories and other texts",
        "text features",
        "literary elements and devices",
        "reading strategies",
        "oral language strategies",
        "metacognitive strategies",
        "writing processes",
        "features of oral language",
        "word patterns, word families",
        "legible handwriting",
        "sentence structure",
        "conventions"
      ],
      "elaborations": [
        {
          "term": "elements of story",
          "detail": "Character, plot, setting, conflict, and theme."
        },
        {
          "term": "text features",
          "detail": "Headings, diagrams, columns, sidebars."
        },
        {
          "term": "literary elements and devices",
          "detail": "Descriptive/poetic/figurative language, images, imagery, rhythm, rhyme, simile, alliteration."
        },
        {
          "term": "how story in First Peoples cultures connects people to land",
          "detail": "First Peoples stories were created to explain the landscape, seasons, and local events."
        },
        {
          "term": "word knowledge",
          "detail": "Morphology, including roots, affixes, and suffixes; also encompasses spelling programs and word-study routines that build this knowledge explicitly."
        },
        {
          "term": "oral traditions",
          "detail": "How culture is transmitted over generations other than through written records \u2014 told stories, songs, dance, carvings/masks; expresses both spiritual/emotional and literal truth."
        },
        {
          "term": "conventions",
          "detail": "Common practices in punctuation of sentences and apostrophe use in contractions."
        }
      ]
    },
    "4": {
      "bigIdeas": [
        "Language and text can be a source of creativity and joy.",
        "Exploring stories and other texts helps us understand ourselves and make connections to others and to the world.",
        "Texts can be understood from different perspectives.",
        "Using language in creative and playful ways helps us understand how language works.",
        "Questioning what we hear, read, and view contributes to our ability to be educated and engaged citizens."
      ],
      "content": [
        "forms, functions, and genres of text",
        "text features",
        "literary elements",
        "literary devices",
        "evidence",
        "reading strategies",
        "oral language strategies",
        "metacognitive strategies",
        "writing processes",
        "features of oral language",
        "paragraph structure",
        "sentence structure and grammar",
        "conventions"
      ],
      "elaborations": [
        {
          "term": "forms/functions/genres",
          "detail": "Forms such as narrative, exposition, report; functions are text purposes; genres are literary/thematic categories (fantasy, humour, adventure, biography)."
        },
        {
          "term": "literary elements",
          "detail": "Theme, character, setting, plot, conflict, purpose."
        },
        {
          "term": "literary devices",
          "detail": "Sensory detail (imagery) and figurative language (metaphor, simile)."
        },
        {
          "term": "organization in meaning",
          "detail": "Use of paragraphing, chronological order, and order of importance to convey meaning."
        },
        {
          "term": "oral tradition in First Peoples cultures",
          "detail": "Means of transmitting culture across generations other than written records \u2014 stories, songs, dance, carvings/masks; expresses spiritual/emotional and literal truth."
        },
        {
          "term": "purposes of First Peoples texts",
          "detail": "Teaching life lessons/skills, conveying community responsibilities, sharing family/community histories, explaining the natural world, recording history, mapping geography."
        },
        {
          "term": "paragraph structure",
          "detail": "Use of a topic sentence and supporting details."
        },
        {
          "term": "grammar",
          "detail": "Parts of speech; past, present, future tenses; subject-verb agreement."
        }
      ]
    },
    "5": {
      "bigIdeas": [
        "Language and text can be a source of creativity and joy.",
        "Exploring stories and other texts helps us understand ourselves and make connections to others and to the world.",
        "Texts can be understood from different perspectives.",
        "Using language in creative and playful ways helps us understand how language works.",
        "Questioning what we hear, read, and view contributes to our ability to be educated and engaged citizens."
      ],
      "content": [
        "forms, functions, and genres of text",
        "text features",
        "literary elements",
        "literary devices",
        "perspective/point of view",
        "reading strategies",
        "oral language strategies",
        "metacognitive strategies",
        "writing processes",
        "features of oral language",
        "paragraphing",
        "sentence structure and grammar",
        "conventions"
      ],
      "elaborations": [
        {
          "term": "literary elements",
          "detail": "Narrative structures and characterization."
        },
        {
          "term": "thinking skills",
          "detail": "Exploring new ideas, determining relative importance, considering alternative viewpoints, developing explanations, summarizing, analyzing, synthesizing."
        },
        {
          "term": "use writing and design processes",
          "detail": "Planning/drafting/editing across forms \u2014 opinion pieces, poetry, short stories, narrative, slams, spoken word, storyboards/comic strips, masks, multimedia."
        },
        {
          "term": "word knowledge",
          "detail": "Morphology, including roots, affixes, and suffixes; also encompasses spelling programs and word-study routines that build this knowledge explicitly."
        },
        {
          "term": "conventions",
          "detail": "Uses of the comma, quotation marks for dialogue, apostrophe in contractions; capitalization in titles/headings; Canadian spelling."
        }
      ]
    },
    "6": {
      "bigIdeas": [
        "Language and text can be a source of creativity and joy.",
        "Exploring stories and other texts helps us understand ourselves and make connections to others and to the world.",
        "Exploring and sharing multiple perspectives extends our thinking.",
        "Developing our understanding of how language works allows us to use it purposefully.",
        "Questioning what we hear, read, and view contributes to our ability to be educated and engaged citizens."
      ],
      "content": [
        "forms, functions, and genres of text",
        "text features",
        "literary elements",
        "literary devices",
        "techniques of persuasion",
        "reading strategies",
        "oral language strategies",
        "metacognitive strategies",
        "writing processes",
        "features of oral language",
        "paragraphing",
        "language varieties",
        "sentence structure and grammar",
        "conventions",
        "presentation techniques"
      ],
      "elaborations": [
        {
          "term": "literary elements, techniques, devices",
          "detail": "Characterization, mood, foreshadowing, conflict, protagonist/antagonist, theme, imagery, sound devices."
        },
        {
          "term": "techniques of persuasion",
          "detail": "Use of emotional and logical appeals to persuade."
        },
        {
          "term": "language varieties",
          "detail": "Regional dialects, standard Canadian vs American English, formal vs informal registers, situational varieties (texting vs essay writing)."
        },
        {
          "term": "refine texts",
          "detail": "Using verbs effectively, repetition/substitution for effect, adding modifiers, varying sentence types, precise diction."
        },
        {
          "term": "oral tradition",
          "detail": "Means of transmitting culture across generations other than written records."
        }
      ]
    },
    "7": {
      "bigIdeas": [
        "Language and text can be a source of creativity and joy.",
        "Exploring stories and other texts helps us understand ourselves and make connections to others and to the world.",
        "Exploring and sharing multiple perspectives extends our thinking.",
        "Developing our understanding of how language works allows us to use it purposefully.",
        "Questioning what we hear, read, and view contributes to our ability to be educated and engaged citizens."
      ],
      "content": [
        "forms, functions, and genres of text",
        "text features",
        "literary elements",
        "literary devices",
        "argument",
        "reading strategies",
        "oral language strategies",
        "metacognitive strategies",
        "writing processes",
        "features of oral language",
        "paragraphing",
        "language varieties",
        "syntax and sentence fluency",
        "conventions",
        "presentation techniques"
      ],
      "elaborations": [
        {
          "term": "validity of First Peoples oral tradition",
          "detail": "Recognize similarities/differences between oral and written records; oral tradition has the same validity, importance, and permanence for First Peoples as written texts for other cultures."
        },
        {
          "term": "how literary elements enhance meaning",
          "detail": "Metaphor brings fresh perspective; diction influences emotional response; hyperbole exaggerates for emphasis; sound devices add to/disrupt aesthetics; imagery evokes sensory experience."
        },
        {
          "term": "refine texts",
          "detail": "Adjusting diction/form for audience, active vs passive voice, parallelism, eliminating wordiness."
        },
        {
          "term": "syntax and sentence fluency",
          "detail": "Mix of simple/compound/complex sentences; pronoun use; subject-verb agreement; transitional words; run-ons and fragments."
        }
      ]
    },
    "8": {
      "bigIdeas": [
        "Language and text can be a source of creativity and joy.",
        "Exploring stories and other texts helps us understand ourselves and make connections to others and to the world.",
        "People understand text differently depending on their worldviews and perspectives.",
        "Texts are socially, culturally, and historically constructed.",
        "Questioning what we hear, read, and view contributes to our ability to be educated and engaged citizens."
      ],
      "content": [
        "forms, functions, and genres of text",
        "text features",
        "literary elements",
        "literary devices",
        "elements of visual/graphic texts",
        "relevance, accuracy, reliability",
        "reading strategies",
        "oral language strategies",
        "metacognitive strategies",
        "writing processes",
        "features of oral language",
        "multi-paragraphing",
        "language usage and context",
        "elements of style",
        "syntax and sentence fluency",
        "conventions",
        "presentation techniques"
      ],
      "elaborations": [
        {
          "term": "protocols",
          "detail": "As applied to local First Peoples stories: recognized customs about when/where stories can be shared, who owns them, who can share them."
        },
        {
          "term": "elements of visual/graphic texts",
          "detail": "Layout, infographics, emoticons, icons, symbols, interactive visuals, hypertext, colour, illustration styles."
        },
        {
          "term": "elements of style",
          "detail": "Diction, figurative language, tone, inclusive language, degree of formality."
        },
        {
          "term": "language usage and context",
          "detail": "Impact of context on language choice (informal texting vs formal essay writing)."
        }
      ]
    },
    "9": {
      "bigIdeas": [
        "Language and story can be a source of creativity and joy.",
        "Exploring stories and other texts helps us understand ourselves and make connections to others and to the world.",
        "People understand text differently depending on their worldviews and perspectives.",
        "Texts are socially, culturally, and historically constructed.",
        "Questioning what we hear, read, and view contributes to our ability to be educated and engaged citizens."
      ],
      "content": [
        "forms, functions, and genres of text",
        "text features",
        "literary elements",
        "literary devices",
        "elements of visual/graphic texts",
        "reading strategies",
        "oral language strategies",
        "metacognitive strategies",
        "writing processes",
        "features of oral language",
        "multi-paragraphing",
        "language change",
        "elements of style",
        "usage",
        "syntax and sentence fluency",
        "conventions",
        "presentation techniques",
        "rhetorical devices",
        "connotation and denotation"
      ],
      "elaborations": [
        {
          "term": "diversity within and across First Peoples societies",
          "detail": "Variety of worldviews and perspectives, diverse traditions, range of historical experiences."
        },
        {
          "term": "language change",
          "detail": "Languages change slowly but continually; evident in dialects; new words emerge as culture changes; new media accelerates change."
        },
        {
          "term": "rhetorical devices",
          "detail": "Figurative language, parallelism, repetition, irony, humour, exaggeration, emotional language, logic, direct address, rhetorical questions, allusion."
        },
        {
          "term": "spelling",
          "detail": "Canadian spelling focus (-our, -re, -ize endings; doubled consonants; grey, licence)."
        }
      ]
    }
  },
  "Social Studies": {
    "K": {
      "bigIdeas": [
        "Our communities are diverse and made up of individuals who have a lot in common.",
        "Stories and traditions about ourselves and our families reflect who we are and where we are from.",
        "Rights, roles, and responsibilities shape our identity and help us build healthy relationships with others."
      ],
      "content": [
        "ways individuals and families differ and are the same",
        "personal and family history and traditions",
        "needs and wants of individuals and families",
        "rights, roles, and responsibilities of individuals and groups",
        "people, places, and events in the local community, including local First Peoples communities"
      ],
      "elaborations": [
        {
          "term": "significance",
          "detail": "Sample activity: give a presentation about a family story or heirloom. Key question: what makes something a personal or family treasure?"
        },
        {
          "term": "continuity and change",
          "detail": "Put significant personal/family milestones in order; place objects in chronological order; use terms then/now/long ago."
        },
        {
          "term": "personal and family history and traditions",
          "detail": "Important life events; family stories (immigration, First Peoples oral histories); traditions/celebrations and associated foods, clothing, art."
        },
        {
          "term": "needs and wants",
          "detail": "Needs: water, food, clothing, love, safety, education, shelter. Wants: toys, entertainment, eating out."
        }
      ]
    },
    "1": {
      "bigIdeas": [
        "We shape the local environment, and the local environment shapes who we are and how we live.",
        "Our rights, roles, and responsibilities are important for building strong communities.",
        "Healthy communities recognize and respect the diversity of individuals and care for the local environment."
      ],
      "content": [
        "characteristics of the local community that meet its needs",
        "diverse cultures, backgrounds, perspectives",
        "relationships between a community and its environment",
        "roles, rights, responsibilities in the local community",
        "key events/developments in the local community and local First Peoples communities",
        "natural and human-made features of the local environment"
      ],
      "elaborations": [
        {
          "term": "local community characteristics",
          "detail": "Local government, public utilities, emergency services, policing, transportation, stores, parks, financial services."
        },
        {
          "term": "natural/human-made features",
          "detail": "Natural: mountains, forests, waterways, plants/animals. Human-made: buildings, bridges, dams, dykes."
        },
        {
          "term": "sample activity",
          "detail": "Compare old and new pictures of locations in your community and discuss how things have changed over time; create a visual timeline of community events."
        }
      ]
    },
    "2": {
      "bigIdeas": [
        "Local actions have global consequences, and global actions have local consequences.",
        "Canada is made up of many diverse regions and communities.",
        "Individuals have rights and responsibilities as global citizens."
      ],
      "content": [
        "diverse characteristics of communities/cultures in Canada and the world (incl. one First Peoples community)",
        "how needs and wants are met in communities",
        "relationships between people and the environment",
        "diverse features of the environment",
        "rights and responsibilities regionally and globally",
        "roles/responsibilities of regional governments"
      ],
      "elaborations": [
        {
          "term": "sample activity",
          "detail": "Interview an Elder or visit a museum to identify changes in your community; create a timeline of key regional events."
        },
        {
          "term": "diverse features of the environment",
          "detail": "Climate zones, landforms, bodies of water, plants and animals."
        },
        {
          "term": "roles/responsibilities of regional governments",
          "detail": "Leaders in the community (mayor, councillors, chief, Elders); services (transportation, policing, firefighting, bylaw enforcement)."
        }
      ]
    },
    "3": {
      "bigIdeas": [
        "Learning about indigenous peoples nurtures multicultural awareness and respect for diversity.",
        "People from diverse cultures and societies share some common experiences and aspects of life.",
        "Indigenous knowledge is passed down through oral history, traditions, and collective memory.",
        "Indigenous societies throughout the world value the well-being of the self, the land, spirits, and ancestors."
      ],
      "content": [
        "cultural characteristics/ways of life of local First Peoples and global indigenous peoples",
        "aspects of life shared by peoples/cultures",
        "interconnections of cultural/technological innovations",
        "governance and social organization",
        "oral history, traditional stories, artifacts as evidence",
        "relationship between humans and their environment"
      ],
      "elaborations": [
        {
          "term": "cultural characteristics",
          "detail": "Worldview, protocols, celebrations, ceremonies, dance, music, spiritual beliefs, art, values, kinship, traditional teachings."
        },
        {
          "term": "governance and social organization",
          "detail": "Consensus, confederacies, Elders, reservations, band councils, traditional leadership."
        },
        {
          "term": "sample activity",
          "detail": "View artifacts from indigenous cultures and speculate on what they might have been used for; explain indigenous peoples' use of oral tradition rather than written language."
        }
      ]
    },
    "4": {
      "bigIdeas": [
        "The pursuit of valuable natural resources has played a key role in changing the land, people, and communities of Canada.",
        "Interactions between First Peoples and Europeans led to conflict and co-operation, which continue to shape Canada's identity.",
        "Demographic changes in North America created shifts in economic and political power.",
        "British Columbia followed a unique path in becoming a part of Canada."
      ],
      "content": [
        "early contact, trade, co-operation, and conflict between First Peoples and Europeans",
        "the fur trade in pre-Confederation Canada and BC",
        "demographic changes in pre-Confederation BC",
        "economic/political factors influencing colonization and Confederation",
        "impact of colonization on First Peoples societies",
        "history of the local community/local First Peoples communities",
        "physiographic features/natural resources of Canada"
      ],
      "elaborations": [
        {
          "term": "fur trade",
          "detail": "Hudson's Bay Company and North West Company; explorers Simon Fraser, Alexander Mackenzie, David Thompson; establishment of trading posts (Victoria, Fort Langley)."
        },
        {
          "term": "colonization impact on First Peoples",
          "detail": "Disease/demographics, loss of territory, impact on language/culture; the Indian Act, potlatch ban, reserve system, residential schools, treaties."
        },
        {
          "term": "sample activity",
          "detail": "Hold a debate about whether BC should have joined the US, Canada, or become independent."
        }
      ]
    },
    "5": {
      "bigIdeas": [
        "Canada's policies for and treatment of minority peoples have negative and positive legacies.",
        "Natural resources continue to shape the economy and identity of different regions of Canada.",
        "Immigration and multiculturalism continue to shape Canadian society and identity.",
        "Canadian institutions and government reflect the challenge of our regional diversity."
      ],
      "content": [
        "development/evolution of Canadian identity",
        "changing nature of Canadian immigration",
        "past discriminatory government policies (Chinese Head Tax, Komagata Maru, residential schools, internments)",
        "human rights and responses to discrimination",
        "levels of government and their functions",
        "participation/representation in Canada's system of government",
        "resources and economic development by region",
        "First Peoples land ownership and use"
      ],
      "elaborations": [
        {
          "term": "levels of government",
          "detail": "Municipal, provincial/territorial, federal, First Peoples; roles like premier, prime minister, MLA, MP, Governor General."
        },
        {
          "term": "discriminatory policies",
          "detail": "Chinese Head Tax, numbered treaties, Doukhobor treatment, Japanese/German internments, First Peoples reserve reductions/relocation."
        },
        {
          "term": "sample activity",
          "detail": "Design a plan of action for a selected problem/issue \u2014 fundraising campaign, letter writing to a politician, petition."
        }
      ]
    },
    "6": {
      "bigIdeas": [
        "Economic self-interest can be a significant cause of conflict among peoples and governments.",
        "Complex global problems require international co-operation to make difficult choices for the future.",
        "Systems of government vary in their respect for human rights and freedoms.",
        "Media sources can both positively and negatively affect our understanding of important events and issues."
      ],
      "content": [
        "urbanization and migration of people",
        "global poverty and inequality (class, gender)",
        "roles of individuals, governmental orgs, NGOs",
        "different systems of government",
        "economic policies and resource management effects on indigenous peoples",
        "globalization and economic interdependence",
        "international co-operation and responses to global issues",
        "regional and international conflict",
        "media technologies and coverage of current events"
      ],
      "elaborations": [
        {
          "term": "different systems of government",
          "detail": "Monarchy, republic, dictatorship, parliamentary democracy; compare Canadian federal government structure with others."
        },
        {
          "term": "media technologies",
          "detail": "Ownership of media, propaganda, editorial bias, sensationalism, freedom of the press, social media uses/abuses."
        },
        {
          "term": "evidence skill",
          "detail": "Determine criteria for evaluating information sources for credibility/reliability \u2014 context, authentic voice, source, objectivity, evidence, authorship."
        }
      ]
    },
    "7": {
      "bigIdeas": [
        "Geographic conditions shaped the emergence of civilizations.",
        "Religious and cultural practices that emerged during this period have endured and continue to influence people.",
        "Increasingly complex societies required new systems of laws and government.",
        "Economic specialization and trade networks can lead to conflict and co-operation between societies."
      ],
      "content": [
        "anthropological origins of humans",
        "human responses to geographic challenges/opportunities",
        "features/characteristics of civilizations and their rise/fall",
        "origins/beliefs/practices of religions (incl. one indigenous to the Americas)",
        "scientific/philosophical/technological developments",
        "interactions/exchanges between past civilizations",
        "social/political/legal/governmental/economic systems (incl. one indigenous to the Americas)"
      ],
      "elaborations": [
        {
          "term": "features of civilizations",
          "detail": "Advanced technology, specialized workers, record keeping, complex institutions, major urban centres."
        },
        {
          "term": "interactions between civilizations",
          "detail": "Egyptian adaptation of chariots from the Hyksos; Roman adaptation of Greek gods/mythology; Sumerian writing/law/irrigation adaptations."
        },
        {
          "term": "sample activity",
          "detail": "Compare maps of early civilizations with modern maps of the same area; create a chart of economic/social hierarchy in a selected ancient culture."
        }
      ]
    },
    "8": {
      "bigIdeas": [
        "Contact and conflict between peoples stimulated significant cultural, social, and political change.",
        "Human and environmental factors shape changes in population and living standards.",
        "Exploration, expansion, and colonization had varying consequences for different groups.",
        "Changing ideas about the world created tension between people wanting to adopt new ideas and those wanting to preserve established traditions."
      ],
      "content": [
        "social/political/economic systems (incl. one indigenous civilization)",
        "scientific and technological innovations",
        "philosophical and cultural shifts",
        "interactions/exchanges of resources, ideas, arts, culture",
        "exploration, expansion, colonization",
        "changes in population and living standards"
      ],
      "elaborations": [
        {
          "term": "interactions between civilizations",
          "detail": "Silk Road, Indian Ocean trade, Crusades, cultural diffusion, Columbian Exchange, imperialism, Renaissance."
        },
        {
          "term": "scientific/technological innovations",
          "detail": "Arab world/Islamic Golden Age, Zheng He and cartography, European navigation tools."
        },
        {
          "term": "sample activity",
          "detail": "Analyze whether an event was caused by underlying systemic factors or an unpredictable event (e.g., the Black Death's role in ending feudalism)."
        }
      ]
    },
    "9": {
      "bigIdeas": [
        "Emerging ideas and ideologies profoundly influence societies and events.",
        "The physical environment influences the nature of political, social, and economic change.",
        "Disparities in power alter the balance of relationships between individuals and between societies.",
        "Collective identity is constructed and can change over time."
      ],
      "content": [
        "political/social/economic/technological revolutions",
        "imperialism and colonialism and continuing effects on indigenous peoples",
        "global demographic shifts (migration, population growth)",
        "nationalism and modern nation-states, including Canada",
        "local/regional/global conflicts",
        "discriminatory policies and injustices (Head Tax, Komagata Maru, residential schools, WWI internment)",
        "physiographic features/natural resources in Canada"
      ],
      "elaborations": [
        {
          "term": "revolutions",
          "detail": "American, French, Industrial, Haitian Revolutions; Red River and Northwest Resistance; new transportation methods."
        },
        {
          "term": "nationalism and nation-states",
          "detail": "Canadian Confederation, CPR, Macdonald's National Policy, Meiji Restoration, unifications of Italy/Germany."
        },
        {
          "term": "sample activity",
          "detail": "Role-play negotiations between stakeholders (environmental groups, forest industry, First Peoples) over a new mine or pipeline."
        }
      ]
    }
  },
  "Applied Design, Skills, and Technologies": {
    "K": {
      "bigIdeas": [
        "Designs grow out of natural curiosity.",
        "Skills are developed through practice, effort, and action.",
        "Complex tasks require the coordination of many skills, often through teamwork."
      ],
      "content": [
        "simple, personally important problems and ideas",
        "actions and results",
        "existing needs and wants"
      ],
      "elaborations": [
        {
          "term": "design process (K-3)",
          "detail": "Understanding context / Defining / Ideating / Prototyping / Testing / Making / Sharing \u2014 an iterative, exploratory cycle appropriate to play-based learning."
        },
        {
          "term": "skills through practice",
          "detail": "Repeated hands-on exploration with simple tools/materials builds fine motor skill and confidence."
        }
      ]
    },
    "1": {
      "bigIdeas": [
        "Designs grow out of natural curiosity.",
        "Skills are developed through practice, effort, and action.",
        "Complex tasks require the coordination of many skills, often through teamwork."
      ],
      "content": [
        "simple problems, ideas, needs, wants of self and others",
        "existing tools, technologies, materials"
      ],
      "elaborations": [
        {
          "term": "needs and wants",
          "detail": "Identify a simple need or want (own or others') as the starting point for a design project."
        }
      ]
    },
    "2": {
      "bigIdeas": [
        "Design can be responsive to identified needs.",
        "Skills are developed through practice, effort, and action.",
        "Complex tasks require the coordination of many skills, often through teamwork."
      ],
      "content": [
        "everyday problems, ideas, needs, wants",
        "elements of story or games"
      ],
      "elaborations": [
        {
          "term": "sample project",
          "detail": "Design and build a simple game or story-based structure incorporating story elements (beginning/middle/end, characters)."
        }
      ]
    },
    "3": {
      "bigIdeas": [
        "Design can be responsive to identified needs.",
        "Skills are developed through practice, effort, and action.",
        "Complex tasks require the coordination of many skills, often through teamwork."
      ],
      "content": [
        "problems and needs of self, family, school, community",
        "peers' processes and ideas"
      ],
      "elaborations": [
        {
          "term": "community-focused projects",
          "detail": "Widening the scope of design problems from self/family to school and local community needs."
        }
      ]
    },
    "4": {
      "bigIdeas": [
        "Design can be responsive to identified needs.",
        "Skills are developed through practice, effort, and action.",
        "Complex tasks require the coordination of many skills, often through teamwork."
      ],
      "content": [
        "local and regional problems/issues",
        "user groups and their needs"
      ],
      "elaborations": [
        {
          "term": "user groups",
          "detail": "Considering specific user groups (e.g., younger students, seniors, people with disabilities) when defining a design problem."
        }
      ]
    },
    "5": {
      "bigIdeas": [
        "Design can be responsive to identified needs.",
        "Skills are developed through practice, effort, and action.",
        "Complex tasks require the coordination of many skills, often through teamwork."
      ],
      "content": [
        "local, regional, or global problems/issues",
        "prototyping and iteration"
      ],
      "elaborations": [
        {
          "term": "prototyping",
          "detail": "Building a low-fidelity model to test a design idea before committing to materials/time on a final version."
        }
      ]
    },
    "6": {
      "bigIdeas": [
        "Design for the life cycle includes consideration of social and environmental impacts.",
        "Complex tasks may require multiple tools and technologies.",
        "Personal design choices consider the exchange of goods and services."
      ],
      "content": [
        "environmental impacts of technologies/materials",
        "cost/availability of resources",
        "collaborative processes"
      ],
      "elaborations": [
        {
          "term": "life cycle design",
          "detail": "Considering sourcing, manufacturing impact, use, and disposal of materials in a design decision."
        }
      ]
    },
    "7": {
      "bigIdeas": [
        "Design for the life cycle includes consideration of social and environmental impacts.",
        "Complex tasks may require multiple tools and technologies.",
        "Personal design choices consider the exchange of goods and services."
      ],
      "content": [
        "social/environmental impact tradeoffs",
        "workplace safety",
        "marketing/promotion of design solutions"
      ],
      "elaborations": [
        {
          "term": "workplace safety",
          "detail": "Following safe practices for tools/materials used, including PPE where relevant."
        }
      ]
    },
    "8": {
      "bigIdeas": [
        "Complex tasks require the composition and structure of a team, and combine the skill sets of individuals.",
        "Personal design choices require self-exploration, collaboration, and evaluation.",
        "Skills combined with only the essential technologies can help solve local and global problems."
      ],
      "content": [
        "local/global issues",
        "target audience/end user",
        "prototypes with increasing complexity"
      ],
      "elaborations": [
        {
          "term": "team roles",
          "detail": "Assigning and evaluating roles within a design team based on individual skill sets and interests."
        }
      ]
    },
    "9": {
      "bigIdeas": [
        "Complex tasks require the composition and structure of a team, and combine the skill sets of individuals.",
        "Personal design choices require self-exploration, collaboration, and evaluation.",
        "Skills combined with only the essential technologies can help solve local and global problems."
      ],
      "content": [
        "specialization within design modules (e.g., textiles, foods, digital media, mechanics)",
        "career connections",
        "critical evaluation of design solutions"
      ],
      "elaborations": [
        {
          "term": "modules",
          "detail": "Grades 8-9 ADST is delivered through elective modules (e.g., textiles, foods, robotics, computer programming, drafting) rather than a single fixed content list; locally developed modules may supplement provincial ones."
        },
        {
          "term": "social factors and textile choices",
          "detail": "Social factors influencing textile choices and the impact of those choices on local communities."
        }
      ]
    }
  },
  "Arts Education": {
    "K": {
      "bigIdeas": [
        "People create art to express who they are as individuals and communities.",
        "Dance, drama, music, and visual arts are each unique languages for creating and communicating.",
        "Experiencing art is a means to develop empathy for others' perspectives and experiences."
      ],
      "content": [
        "elements of dance, drama, music, visual arts",
        "local First Peoples arts",
        "materials, tools, technologies"
      ],
      "elaborations": [
        {
          "term": "elements of dance",
          "detail": "Body, space, time, energy."
        },
        {
          "term": "elements of visual arts",
          "detail": "Line, shape, colour, texture."
        }
      ]
    },
    "1": {
      "bigIdeas": [
        "People create art to express who they are as individuals and communities.",
        "Dance, drama, music, and visual arts are each unique languages for creating and communicating.",
        "Experiencing art is a means to develop empathy for others' perspectives and experiences."
      ],
      "content": [
        "elements and principles of dance/drama/music/visual arts",
        "elements of story and performance"
      ],
      "elaborations": []
    },
    "2": {
      "bigIdeas": [
        "People create art to explore, express, and represent their perceptions, ideas, and feelings.",
        "Dance, drama, music, and visual arts are each unique languages for creating and communicating.",
        "Engaging in the arts develops the ability to understand and express complex ideas."
      ],
      "content": [
        "elements/principles across art forms",
        "personal preferences in the arts",
        "local First Peoples art"
      ],
      "elaborations": []
    },
    "3": {
      "bigIdeas": [
        "People create art to explore, express, and represent their perceptions, ideas, and feelings.",
        "Dance, drama, music, and visual arts are each unique languages for creating and communicating.",
        "Engaging in the arts develops the ability to understand and express complex ideas."
      ],
      "content": [
        "elements/principles of design across art forms",
        "traditional and contemporary First Peoples arts",
        "purpose of art in various times and cultures"
      ],
      "elaborations": []
    },
    "4": {
      "bigIdeas": [
        "Personal experiences and points of view shape identity in the arts.",
        "Artistic expressions differ across time and place.",
        "Engaging in creative expression and experiences expands people's sense of identity and community, and helps them define who they are."
      ],
      "content": [
        "forms/elements/principles across dance/drama/music/visual arts",
        "significant works of art from local First Peoples cultures",
        "role of visual and performing arts in various times/cultures"
      ],
      "elaborations": []
    },
    "5": {
      "bigIdeas": [
        "Personal experiences and points of view shape identity in the arts.",
        "Artistic expressions differ across time and place.",
        "Engaging in creative expression and experiences expands people's sense of identity and community, and helps them define who they are."
      ],
      "content": [
        "responding to art in personal/critical ways",
        "the arts as a reflection of cultural identity",
        "influence of local First Peoples arts on personal expression"
      ],
      "elaborations": []
    },
    "6": {
      "bigIdeas": [
        "The arts provide unique ways to comment on the world.",
        "The arts connect our experiences to those of others.",
        "First Peoples cultures are preserved, communicated, and reaffirmed through the arts."
      ],
      "content": [
        "choreographic/dramatic/musical/visual arts elements at an increasing level of complexity",
        "protocols associated with sharing/presenting First Peoples art"
      ],
      "elaborations": []
    },
    "7": {
      "bigIdeas": [
        "The arts provide unique ways to comment on the world.",
        "The arts connect our experiences to those of others.",
        "First Peoples cultures are preserved, communicated, and reaffirmed through the arts."
      ],
      "content": [
        "technical skill development across art forms",
        "significant works/genres of art across cultures/times",
        "own artistic development over time"
      ],
      "elaborations": []
    },
    "8": {
      "bigIdeas": [
        "Individual and collective expression is rooted in history, tradition, and cultural identity.",
        "Art challenges perceptions and encourages dialogue about important issues.",
        "Personal engagement in the arts increases awareness and appreciation of self, community, and world."
      ],
      "content": [
        "intended purpose of design choices",
        "elements and design principles in analysis/composition",
        "influence of historical/social/cultural context on art"
      ],
      "elaborations": []
    },
    "9": {
      "bigIdeas": [
        "Individual and collective expression is rooted in history, tradition, and cultural identity.",
        "Art challenges perceptions and encourages dialogue about important issues.",
        "Personal engagement in the arts increases awareness and appreciation of self, community, and world."
      ],
      "content": [
        "personal artistic voice/style development",
        "professional arts practices and career connections",
        "critical response to own and others' work"
      ],
      "elaborations": [
        {
          "term": "grades 9-12 structure",
          "detail": "Arts Education splits into discrete elective courses (Dance, Drama, Music, Visual Arts and their sub-strands) starting Grade 9; content becomes course-specific rather than a single combined K-8 stream."
        }
      ]
    }
  },
  "Physical Education": {
    "K": {
      "bigIdeas": [
        "Learning about ourselves and others helps us develop a positive sense of self.",
        "Being active every day, in a variety of ways, helps us develop movement skills and physical literacy.",
        "Learning how to participate and move our bodies in different physical activities helps us develop new skills."
      ],
      "content": [
        "basic locomotor and non-locomotor movement",
        "personal hygiene practices",
        "healthy relationships",
        "safety at home/school"
      ],
      "elaborations": [
        {
          "term": "locomotor movement",
          "detail": "Walking, running, hopping, jumping, skipping, galloping."
        }
      ]
    },
    "1": {
      "bigIdeas": [
        "Daily participation in physical activity at moderate to vigorous intensity levels benefits all aspects of our wellness.",
        "Learning proper technique for fundamental movement skills prepares us for a variety of physical activities.",
        "Having good communication skills and managing our feelings help us develop and maintain healthy relationships."
      ],
      "content": [
        "proper technique for fundamental movement skills",
        "physical literacy",
        "personal social skills",
        "food groups"
      ],
      "elaborations": []
    },
    "2": {
      "bigIdeas": [
        "Regular participation in physical activity, at moderate to vigorous intensity levels, benefits all aspects of our wellness.",
        "Learning about our strengths and taking risks in a variety of physical activities builds confidence.",
        "Having good communication skills and managing our feelings help us develop and maintain healthy relationships."
      ],
      "content": [
        "proper technique for fundamental movement skills in a variety of activities",
        "opportunities for participation",
        "healthy eating habits"
      ],
      "elaborations": []
    },
    "3": {
      "bigIdeas": [
        "Daily physical activity helps us develop physical literacy and helps all body systems function well.",
        "Learning how to participate and move our bodies in different physical activities helps us develop movement skills.",
        "Developing healthy relationships helps us feel connected to others and supports our mental health."
      ],
      "content": [
        "proper technique for a variety of movement skills in more complex activities",
        "importance of teamwork",
        "impacts of bullying, stereotyping, discrimination"
      ],
      "elaborations": []
    },
    "4": {
      "bigIdeas": [
        "Developing competency in fundamental movement skills provides the foundation for developing physical literacy.",
        "Understanding how and why our bodies respond to physical activity helps us stay active throughout our lives.",
        "Understanding our unique bodies, and the changes we experience, helps us develop a positive self-image."
      ],
      "content": [
        "proper technique for a variety of movement skills in a variety of physical activities",
        "how the body responds to participation in physical activity",
        "puberty and how it relates to personal identity"
      ],
      "elaborations": []
    },
    "5": {
      "bigIdeas": [
        "Developing competency in fundamental movement skills provides the foundation for developing physical literacy.",
        "Regular participation in outdoor physical activities can increase our connection to and appreciation of the natural world.",
        "Advocating for our own and others' health and well-being can help us develop our sense of self-worth."
      ],
      "content": [
        "ethical/safe/fair use of physical activity spaces including outdoor spaces",
        "healthy eating including reducing/preventing risk",
        "signs and symptoms of mental illness"
      ],
      "elaborations": []
    },
    "6": {
      "bigIdeas": [
        "Understanding boundaries and safety guidelines helps ensure we can participate in physical activities in a safe way.",
        "Confidence in our ability to move our bodies in a variety of physical activities promotes an active lifestyle.",
        "Developing healthy relationships helps us feel connected to others and supports our mental well-being."
      ],
      "content": [
        "boundaries and use of protective equipment",
        "training principles to improve physical fitness",
        "healthy sexual decision making",
        "impacts of substance use on health"
      ],
      "elaborations": []
    },
    "7": {
      "bigIdeas": [
        "Developing our physical literacy provides a foundation for lifelong physical activity, which benefits our health and fitness.",
        "Individual and collective responses to change, stress, and difficult situations influence our mental well-being and our ability to cope with adversity.",
        "Learning to become an effective leader requires self-awareness and an understanding of the needs of others."
      ],
      "content": [
        "how strategy and planning can enhance performance",
        "process/factors of stress, its causes and effects on overall health and well-being",
        "healthy sexual decision making"
      ],
      "elaborations": []
    },
    "8": {
      "bigIdeas": [
        "Understanding our strengths and areas for growth in movement helps us pursue our goals and improve physical literacy.",
        "Understanding the impacts of technology on our lives can help us maintain a healthy balance.",
        "Understanding the importance of our mental health and well-being can help us develop coping strategies for dealing with life's challenges."
      ],
      "content": [
        "health benefits of physical activity, exercise, and sport",
        "effects of substance use on the mind, body, and life quality",
        "signs and symptoms of substance use, addiction, mental illness"
      ],
      "elaborations": []
    },
    "9": {
      "bigIdeas": [
        "Personal fitness, our attitudes, and our choices influence our own health and wellness throughout our lives.",
        "Advocating for the health and well-being of others connects us to our community.",
        "The way we treat ourselves and others impacts our overall health and well-being."
      ],
      "content": [
        "health benefits related to different types of physical activity, exercise, and sport",
        "understanding of consent and how to communicate personal boundaries",
        "signs and symptoms of substance use, addiction, mental illness"
      ],
      "elaborations": []
    }
  },
  "Health & Career Education": {
    "K": {
      "bigIdeas": [
        "Everyone has different interests, skills, and ways of doing things.",
        "Skills can be developed through practice.",
        "Playing and connecting with others in different ways helps us learn about ourselves."
      ],
      "content": [
        "personal interests, skills, strengths",
        "different jobs/roles in the classroom/school"
      ],
      "elaborations": []
    },
    "1": {
      "bigIdeas": [
        "Everyone has different interests, skills, and ways of doing things.",
        "Skills can be developed through practice.",
        "Playing and connecting with others in different ways helps us learn about ourselves."
      ],
      "content": [
        "jobs/roles in the school and local community",
        "skills for making and maintaining friendships"
      ],
      "elaborations": []
    },
    "2": {
      "bigIdeas": [
        "Everyone has strengths and skills that they can develop.",
        "Setting goals allows us to focus on what we want to achieve.",
        "Simple financial concepts can support decisions about spending and saving."
      ],
      "content": [
        "jobs/roles in the local community",
        "simple financial concepts (spending, saving)",
        "goal setting"
      ],
      "elaborations": []
    },
    "3": {
      "bigIdeas": [
        "Everyone has strengths and skills that they can develop.",
        "Setting goals allows us to focus on what we want to achieve.",
        "Simple financial concepts can support decisions about spending and saving."
      ],
      "content": [
        "skill development through effort/practice",
        "personal/family financial goals"
      ],
      "elaborations": []
    },
    "4": {
      "bigIdeas": [
        "Learning about our strengths and taking on new roles and responsibilities helps us build our identity.",
        "Developing our strengths and taking on new roles and responsibilities can help us achieve our goals.",
        "Financial literacy provides for informed decision making."
      ],
      "content": [
        "local labour market",
        "roles and responsibilities in various settings",
        "budgeting and consumer awareness"
      ],
      "elaborations": []
    },
    "5": {
      "bigIdeas": [
        "Learning about our strengths and taking on new roles and responsibilities helps us build our identity.",
        "Developing our strengths and taking on new roles and responsibilities can help us achieve our goals.",
        "Financial literacy provides for informed decision making."
      ],
      "content": [
        "local, regional, and global career/labour options",
        "financial decision-making processes"
      ],
      "elaborations": []
    },
    "6": {
      "bigIdeas": [
        "Career-life development is a lifelong process without predictable pathways.",
        "Understanding our strengths and abilities, and having strategies to develop them, helps us pursue education, training, and opportunities that are of interest to us.",
        "Skills for career-life planning and management can be developed through school, community, and family responsibilities and interactions."
      ],
      "content": [
        "career-life planning skills",
        "roles/responsibilities in family/community/workplace",
        "financial goals and decisions"
      ],
      "elaborations": []
    },
    "7": {
      "bigIdeas": [
        "Career-life development is a lifelong process without predictable pathways.",
        "Understanding our strengths and abilities, and having strategies to develop them, helps us pursue education, training, and opportunities that are of interest to us.",
        "Skills for career-life planning and management can be developed through school, community, and family responsibilities and interactions."
      ],
      "content": [
        "local labour market trends",
        "transferable skills across contexts",
        "financial literacy (budgeting, saving, credit basics)"
      ],
      "elaborations": []
    },
    "8": {
      "bigIdeas": [
        "Career-life development includes management of mental well-being, education, life, and work in a changing world.",
        "Personal and social competencies help us develop the ability to plan and be innovative in a changing world.",
        "Financial literacy empowers us to be smart, savvy, and involved citizens who advocate for ourselves and others."
      ],
      "content": [
        "personal/social competencies development",
        "education/career pathway options",
        "budgeting, credit, and consumer rights"
      ],
      "elaborations": []
    },
    "9": {
      "bigIdeas": [
        "Career-life development includes management of mental well-being, education, life, and work in a changing world.",
        "Personal and social competencies help us develop the ability to plan and be innovative in a changing world.",
        "Financial literacy empowers us to be smart, savvy, and involved citizens who advocate for ourselves and others."
      ],
      "content": [
        "career-life planning tools and portfolios",
        "post-secondary/training pathway exploration",
        "employment rights/responsibilities",
        "advanced budgeting and financial planning"
      ],
      "elaborations": []
    }
  },
  "French": {
    "5": {
      "bigIdeas": [
        "Language and culture are interconnected and reflect our identity and our world view.",
        "Understanding how languages work allows us to participate in a variety of communities.",
        "Exploring language and culture supports our understanding of one another."
      ],
      "content": [
        "basic vocabulary and phrases for everyday needs",
        "simple sentence structures",
        "francophone communities and cultural practices"
      ],
      "elaborations": [
        {
          "term": "grades 5-9 only",
          "detail": "BC's Core French program begins at Grade 5 \u2014 there is no K-4 Core French curriculum. Grades 11-12 split into distinct courses (Core French 11/12, Core French Introductory 11)."
        }
      ]
    },
    "6": {
      "bigIdeas": [
        "Language and culture are interconnected and reflect our identity and our world view.",
        "Understanding how languages work allows us to participate in a variety of communities.",
        "Exploring language and culture supports our understanding of one another."
      ],
      "content": [
        "expanded vocabulary for personal/social topics",
        "question formation and simple conversation",
        "francophone cultural celebrations/practices"
      ],
      "elaborations": []
    },
    "7": {
      "bigIdeas": [
        "Language and culture are interconnected and reflect our identity and our world view.",
        "Understanding how languages work allows us to participate in a variety of communities.",
        "Exploring language and culture supports our understanding of one another."
      ],
      "content": [
        "narrating in present/near future tense",
        "reading/responding to short authentic texts",
        "comparing francophone and local cultural practices"
      ],
      "elaborations": []
    },
    "8": {
      "bigIdeas": [
        "Language and culture are interconnected and reflect our identity and our world view.",
        "Understanding how languages work allows us to participate in a variety of communities.",
        "Exploring language and culture supports our understanding of one another."
      ],
      "content": [
        "more complex sentence structures and verb tenses",
        "producing short written/oral texts on familiar topics",
        "critical comparison of cultural perspectives"
      ],
      "elaborations": []
    },
    "9": {
      "bigIdeas": [
        "Language and culture are interconnected and reflect our identity and our world view.",
        "Understanding how languages work allows us to participate in a variety of communities.",
        "Exploring language and culture supports our understanding of one another."
      ],
      "content": [
        "sustained conversation and narration across tenses",
        "analysis of authentic francophone media/texts",
        "reflection on language learning strategies"
      ],
      "elaborations": []
    }
  },
  "Mathematics": {
    "K": {
      "bigIdeas": [
        "Numbers represent quantities that can be decomposed into smaller parts.",
        "One-to-one correspondence and a sense of 5 and 10 are essential for fluency with numbers.",
        "Repeating elements in patterns can be identified.",
        "Objects have attributes that can be described, measured, and compared.",
        "Familiar events can be described as likely or unlikely and compared."
      ],
      "content": [
        "number concepts to 10",
        "ways to make 5",
        "decomposition of numbers to 10",
        "repeating patterns with two or three elements",
        "change in quantity to 10",
        "equality as a balance and inequality as an imbalance",
        "direct comparative measurement",
        "single attributes of 2D shapes and 3D objects",
        "concrete/pictorial graphs",
        "likelihood of familiar life events",
        "financial literacy \u2014 attributes of coins"
      ],
      "elaborations": [
        {
          "term": "Number (Big Idea)",
          "detail": "Number represents and describes quantity. Sample questions: Which numbers of counters/dots are easy to recognize and why? In how many ways can you decompose a number?"
        },
        {
          "term": "Computational Fluency",
          "detail": "Develops from a strong sense of number. Sample question: If you know 4 and 6 make 10, how does that help you understand other ways to make 10?"
        },
        {
          "term": "Patterning",
          "detail": "We use patterns to represent identified regularities and make generalizations. Sample question: What makes a pattern a pattern?"
        },
        {
          "term": "financial literacy",
          "detail": "Noticing attributes of Canadian coins (colour, size, pictures), identifying coin names, role-playing financial transactions integrating wants/needs."
        },
        {
          "term": "First Peoples connections",
          "detail": "Patterns are important in First Peoples technology, architecture, and artwork; invite local Elders/knowledge keepers to share knowledge."
        }
      ]
    },
    "1": {
      "bigIdeas": [
        "Numbers to 20 represent quantities that can be decomposed into 10s and 1s.",
        "Addition and subtraction with numbers to 10 can be modelled concretely, pictorially, and symbolically to develop computational fluency.",
        "Repeating elements in patterns can be identified.",
        "Objects and shapes have attributes that can be described, measured, and compared.",
        "Concrete graphs help us to compare and interpret data and show one-to-one correspondence."
      ],
      "content": [
        "number concepts to 20",
        "ways to make 10",
        "addition and subtraction to 20",
        "repeating patterns with multiple elements and attributes",
        "change in quantity to 20",
        "meaning of equality and inequality",
        "direct measurement with non-standard units",
        "comparison of 2D shapes and 3D objects",
        "concrete graphs using one-to-one correspondence",
        "likelihood of familiar life events using comparative language",
        "financial literacy \u2014 values of coins, monetary exchanges"
      ],
      "elaborations": [
        {
          "term": "addition/subtraction facts",
          "detail": "Mental math strategies: counting on, making 10, doubles. Addition and subtraction are related; whole-class number talks."
        },
        {
          "term": "direct measurement",
          "detail": "Non-uniform units (hands, pencils) vs uniform units (interlocking cubes); iterating a single unit for measuring."
        },
        {
          "term": "financial literacy",
          "detail": "Identifying values of coins (nickels, dimes, quarters, loonies, toonies); role-playing financial transactions; trade games."
        }
      ]
    },
    "2": {
      "bigIdeas": [
        "Numbers to 100 represent quantities that can be decomposed into 10s and 1s.",
        "Development of computational fluency in addition and subtraction with numbers to 100 requires an understanding of place value.",
        "The regular change in increasing patterns can be identified and used to make generalizations.",
        "Objects and shapes have attributes that can be described, measured, and compared.",
        "Concrete items can be represented, compared, and interpreted pictorially in graphs."
      ],
      "content": [
        "number concepts to 100",
        "benchmarks of 25, 50, 100",
        "addition/subtraction facts to 20",
        "addition/subtraction to 100",
        "repeating and increasing patterns",
        "symbolic representation of equality/inequality",
        "direct linear measurement with standard metric units",
        "multiple attributes of 2D/3D shapes",
        "pictorial representation of concrete graphs",
        "likelihood using comparative language",
        "financial literacy \u2014 coin combinations to 100 cents"
      ],
      "elaborations": [
        {
          "term": "place value",
          "detail": "Understanding of 10s and 1s; relationship between digit places and value to 99; decomposing two-digit numbers."
        },
        {
          "term": "addition/subtraction strategies",
          "detail": "Multiples of 10, friendly numbers, decomposing into 10s/1s and recomposing, compensating; open number line, hundred chart, ten-frames."
        },
        {
          "term": "financial literacy",
          "detail": "Counting mixed coin combinations to 100 cents; introduction to spending/saving; role-playing with bills and coins."
        }
      ]
    },
    "3": {
      "bigIdeas": [
        "Fractions are a type of number that can represent quantities.",
        "Development of computational fluency in addition, subtraction, multiplication, and division of whole numbers requires flexible decomposing and composing.",
        "Regular increases and decreases in patterns can be identified and used to make generalizations.",
        "Standard units are used to describe, measure, and compare attributes of objects' shapes.",
        "The likelihood of possible outcomes can be examined, compared, and interpreted."
      ],
      "content": [
        "number concepts to 1000",
        "fraction concepts",
        "addition/subtraction to 1000",
        "multiplication and division concepts",
        "increasing/decreasing patterns",
        "pattern rules using words and numbers",
        "one-step equations with an unknown number",
        "measurement using standard units",
        "time concepts",
        "construction of 3D shapes",
        "one-to-one correspondence with bar graphs/pictographs",
        "likelihood of simulated events",
        "financial literacy \u2014 coins/bills to $100"
      ],
      "elaborations": [
        {
          "term": "fraction concepts",
          "detail": "Fractions represent an amount/quantity, parts of a region/set/linear model; equal partitioning; equal sharing."
        },
        {
          "term": "multiplication/division concepts",
          "detail": "Groups of, arrays, repeated addition (multiplication); sharing, grouping, repeated subtraction (division); memorization not intended at this level."
        },
        {
          "term": "3D shapes",
          "detail": "Identifying by 2D faces and number of edges/vertices; sphere, cube, prism, cone, cylinder; nets/skeletons."
        },
        {
          "term": "financial literacy",
          "detail": "Counting mixed coins/bills to $100; understanding flexible payment methods; different ways of earning money."
        }
      ]
    },
    "4": {
      "bigIdeas": [
        "Fractions and decimals are types of numbers that can represent quantities.",
        "Development of computational fluency and multiplicative thinking requires analysis of patterns and relations in multiplication and division.",
        "Regular changes in patterns can be identified and represented using tools and tables.",
        "Polygons are closed shapes with similar attributes that can be described, measured, and compared.",
        "Analyzing and interpreting experiments in data probability develops an understanding of chance."
      ],
      "content": [
        "number concepts to 10 000",
        "decimals to hundredths",
        "ordering/comparing fractions",
        "addition/subtraction to 10 000",
        "multiplication and division of 2-3 digit numbers by 1-digit",
        "addition/subtraction of decimals to hundredths",
        "increasing/decreasing patterns using tables/charts",
        "algebraic relationships",
        "one-step equations with an unknown number",
        "telling time (analog/digital, 12/24hr)",
        "regular and irregular polygons",
        "perimeter",
        "line symmetry",
        "many-to-one correspondence",
        "probability experiments",
        "financial literacy \u2014 making change to $100"
      ],
      "elaborations": [
        {
          "term": "polygons",
          "detail": "Describing/sorting regular and irregular polygons based on multiple attributes."
        },
        {
          "term": "line symmetry",
          "detail": "Using pattern blocks to create mirror-image designs; connection to First Peoples art, borders, birchbark biting, canoe building."
        },
        {
          "term": "probability experiments",
          "detail": "Predicting single outcomes with spinners/dice; recording results using tallies."
        },
        {
          "term": "financial literacy",
          "detail": "Making monetary calculations with decimal notation; counting up/back/decomposing to make change; simple financial decisions."
        }
      ]
    },
    "5": {
      "bigIdeas": [
        "Numbers describe quantities that can be represented by equivalent fractions.",
        "Computational fluency and flexibility with numbers extend to operations with larger (multi-digit) numbers.",
        "Identified regularities in number patterns can be expressed in tables.",
        "Closed shapes have area and perimeter that can be described, measured, and compared.",
        "Data represented in graphs can be used to show many-to-one correspondence."
      ],
      "content": [
        "number concepts to 1 000 000",
        "decimals to thousandths",
        "equivalent fractions",
        "addition/subtraction of whole numbers to 1 000 000",
        "multiplication/division to 3 digits including remainders",
        "rules for increasing/decreasing patterns with words, numbers, symbols, variables",
        "one-step equations with variables",
        "area of squares/rectangles",
        "relationships between area and perimeter",
        "classification of prisms and pyramids",
        "single transformations",
        "probability experiments",
        "financial literacy \u2014 making change to $1000"
      ],
      "elaborations": [
        {
          "term": "equivalent fractions",
          "detail": "Two equivalent fractions are two ways to represent the same amount (having the same whole)."
        },
        {
          "term": "transformations",
          "detail": "Single transformations (slide/translation, flip/reflection, turn/rotation) using concrete materials; weaving, cedar baskets, designs."
        },
        {
          "term": "financial literacy",
          "detail": "Making change and decimal notation to $1000; simple financial plans; developing a budget accounting for income and expenses."
        }
      ]
    },
    "6": {
      "bigIdeas": [
        "Mixed numbers and decimal numbers represent quantities that can be decomposed into parts and wholes.",
        "Computational fluency and flexibility with numbers extend to operations with whole numbers and decimals.",
        "Linear relations can be identified and represented using expressions with variables and line graphs and can be used to form generalizations.",
        "Properties of objects and shapes can be described, measured, and compared using volume, area, perimeter, and angles.",
        "Data from the results of an experiment can be used to predict the theoretical probability of an event and to compare and interpret."
      ],
      "content": [
        "small to large numbers (thousandths to billions)",
        "order of operations",
        "factors and multiples",
        "improper fractions and mixed numbers",
        "introduction to ratios",
        "whole-number percents",
        "multiplication/division of decimals",
        "patterns using expressions, tables, graphs",
        "one-step equations",
        "perimeter of complex shapes",
        "area of triangles/parallelograms/trapezoids",
        "angle measurement and classification",
        "volume and capacity",
        "triangles",
        "transformations",
        "line graphs",
        "single-outcome probability",
        "financial literacy \u2014 simple budgeting"
      ],
      "elaborations": [
        {
          "term": "ratios",
          "detail": "Comparing numbers/quantities; equivalent ratios; part-to-part and part-to-whole ratios."
        },
        {
          "term": "angle",
          "detail": "Straight, acute, right, obtuse, reflex; estimating using 45\u00b0, 90\u00b0, 180\u00b0 as reference angles."
        },
        {
          "term": "volume and capacity",
          "detail": "Using cubes to build 3D objects and determine volume; referents/relationships between units (cm\u00b3, m\u00b3, mL, L)."
        },
        {
          "term": "financial literacy",
          "detail": "Informed decision-making on saving/purchasing (e.g., how many weeks of allowance to buy a bicycle)."
        }
      ]
    },
    "7": {
      "bigIdeas": [
        "Decimals, fractions, and percents are used to represent and describe parts and wholes of numbers.",
        "Computational fluency and flexibility with numbers extend to operations with integers and decimals.",
        "Linear relations can be represented in many connected ways to identify regularities and make generalizations.",
        "The constant ratio between the circumference and diameter of circles can be used to describe, measure, and compare spatial relationships.",
        "Data from circle graphs can be used to illustrate proportion and to compare and interpret."
      ],
      "content": [
        "operations with integers",
        "operations with decimals",
        "relationships between decimals, fractions, ratios, percents",
        "discrete linear relations",
        "two-step equations",
        "circumference and area of circles",
        "volume of rectangular prisms and cylinders",
        "Cartesian coordinates and graphing",
        "combinations of transformations",
        "circle graphs",
        "experimental probability with two independent events",
        "financial literacy \u2014 financial percentage"
      ],
      "elaborations": [
        {
          "term": "circumference",
          "detail": "Finding relationships between radius, diameter, circumference, area to develop C = \u03c0d and A = \u03c0r\u00b2 formulas."
        },
        {
          "term": "circle graphs",
          "detail": "Constructing, labelling, interpreting; translating percentages into quantities and vice versa."
        },
        {
          "term": "financial literacy",
          "detail": "Financial percentage calculations \u2014 sales tax, tips, discount, sale price."
        }
      ]
    },
    "8": {
      "bigIdeas": [
        "Number represents, describes, and compares the quantities of ratios, rates, and percents.",
        "Computational fluency and flexibility extend to operations with fractions.",
        "Discrete linear relationships can be represented in many connected ways and used to identify and make generalizations.",
        "The relationship between surface area and volume of 3D objects can be used to describe, measure, and compare spatial relationships.",
        "Analyzing data by determining averages is one way to make sense of large data sets and enables us to compare and interpret."
      ],
      "content": [
        "perfect squares and cubes",
        "square and cube roots",
        "percents less than 1 and greater than 100",
        "numerical proportional reasoning",
        "operations with fractions",
        "discrete linear relations",
        "expressions",
        "two-step equations with integers",
        "surface area and volume of regular solids",
        "Pythagorean theorem",
        "construction/views/nets of 3D objects",
        "central tendency",
        "theoretical probability with two independent events",
        "financial literacy \u2014 best buys"
      ],
      "elaborations": [
        {
          "term": "Pythagorean theorem",
          "detail": "Modelling, finding a missing side of a right triangle, deriving the theorem; constructing canoe paths given river current."
        },
        {
          "term": "central tendency",
          "detail": "Mean, median, and mode."
        },
        {
          "term": "financial literacy",
          "detail": "Coupons, proportions, unit price; unit rate and equivalent fractions given prices and quantities."
        }
      ]
    },
    "9": {
      "bigIdeas": [
        "The principles and processes underlying operations with numbers apply equally to algebraic situations and can be described and analyzed.",
        "Computational fluency and flexibility with numbers extend to operations with rational numbers.",
        "Continuous linear relationships can be identified and represented in many connected ways to identify regularities and make generalizations.",
        "Similar shapes have proportional relationships that can be described, measured, and compared.",
        "Analyzing the validity, reliability, and representation of data enables us to compare and interpret."
      ],
      "content": [
        "operations with rational numbers",
        "exponents and exponent laws",
        "operations with polynomials (degree \u22642)",
        "two-variable linear relations",
        "multi-step one-variable linear equations",
        "spatial proportional reasoning",
        "statistics in society",
        "financial literacy \u2014 simple budgets and transactions"
      ],
      "elaborations": [
        {
          "term": "polynomials",
          "detail": "Variables, degree, number of terms, coefficients including constant term; using algebra tiles."
        },
        {
          "term": "proportional reasoning",
          "detail": "Scale diagrams, similar triangles/polygons, linear unit conversions (metric)."
        },
        {
          "term": "statistics",
          "detail": "Population vs sample, bias, ethics, sampling techniques, misleading stats; analyzing data for bias, language, ethics, privacy, cultural sensitivity."
        },
        {
          "term": "financial literacy",
          "detail": "Banking, simple interest, savings, planned purchases."
        }
      ]
    }
  },
  "Science": {
    "K": {
      "bigIdeas": [
        "Plants and animals have observable features.",
        "Humans interact with matter every day through familiar materials.",
        "The motion of objects depends on their properties.",
        "Daily and seasonal changes affect all living things."
      ],
      "content": [
        "basic needs of plants and animals",
        "adaptations of local plants and animals",
        "local First Peoples uses of plants and animals",
        "properties of familiar materials",
        "effects of pushes/pulls on movement",
        "effects of size, shape, materials on movement",
        "weather changes",
        "seasonal changes",
        "living things make changes to accommodate daily/seasonal cycles",
        "First Peoples knowledge of seasonal changes"
      ],
      "elaborations": [
        {
          "term": "basic needs",
          "detail": "Habitat \u2014 food, water, shelter, space."
        },
        {
          "term": "adaptations",
          "detail": "Structural features or behaviours that allow organisms to survive."
        },
        {
          "term": "properties (matter)",
          "detail": "Colour, texture, flexibility, hardness, lustre, absorbency."
        },
        {
          "term": "weather",
          "detail": "Temperature, cloud cover, precipitation, wind."
        },
        {
          "term": "living things make changes",
          "detail": "Physical/behavioural changes to survive in different conditions (migration, hibernation)."
        }
      ]
    },
    "1": {
      "bigIdeas": [
        "Living things have features and behaviours that help them survive in their environment.",
        "Matter is useful because of its properties.",
        "Light and sound can be produced and their properties can be changed.",
        "Observable patterns and cycles occur in the local sky and landscape."
      ],
      "content": [
        "classification of living/non-living things",
        "names of local plants and animals",
        "structural features of living things",
        "behavioural adaptations of animals",
        "specific properties of materials",
        "natural and artificial sources of light and sound",
        "properties of light and sound",
        "common objects in the sky",
        "First Peoples knowledge of sky/landscape/seasonal rounds",
        "local patterns on Earth and in the sky"
      ],
      "elaborations": [
        {
          "term": "behavioural adaptations",
          "detail": "Dormancy, hibernation, nesting, migration, catching food, camouflage, mimicry, territorialism."
        },
        {
          "term": "properties of light",
          "detail": "Brightness, colour; objects visible by radiating or reflecting light; light interactions create images/shadows; plants grow toward light."
        },
        {
          "term": "seasonal rounds",
          "detail": "A pattern of movement from one resource-gathering area to another in a cycle followed each year."
        }
      ]
    },
    "2": {
      "bigIdeas": [
        "Living things have life cycles adapted to their environment.",
        "Materials can be changed through physical and chemical processes.",
        "Forces influence the motion of an object.",
        "Water is essential to all living things, and it cycles through the environment."
      ],
      "content": [
        "metamorphic and non-metamorphic life cycles",
        "similarities/differences between offspring and parent",
        "First Peoples use of knowledge of life cycles",
        "physical ways of changing materials",
        "chemical ways of changing materials",
        "types of forces",
        "water sources including local watersheds",
        "water conservation",
        "the water cycle",
        "local First Peoples knowledge of water"
      ],
      "elaborations": [
        {
          "term": "metamorphic vs non-metamorphic",
          "detail": "Metamorphic: body structure changes (caterpillar to butterfly). Non-metamorphic: same structure, size changes (humans)."
        },
        {
          "term": "forces",
          "detail": "Contact and at-a-distance forces (magnets, static electricity); balanced/unbalanced forces (air resistance, motion over materials)."
        },
        {
          "term": "water cycle",
          "detail": "Driven by the sun: evaporation, condensation, precipitation, runoff; major component of weather."
        }
      ]
    },
    "3": {
      "bigIdeas": [
        "Living things are diverse, can be grouped, and interact in their ecosystems.",
        "All matter is made of particles.",
        "Thermal energy can be produced and transferred.",
        "Wind, water, and ice change the shape of the land."
      ],
      "content": [
        "biodiversity in the local environment",
        "energy is needed for life",
        "matter is anything that has mass and takes up space",
        "atoms are building blocks of matter",
        "sources of thermal energy",
        "transfer of thermal energy",
        "major local landforms",
        "local First Peoples knowledge of landforms",
        "changes caused by erosion and deposition"
      ],
      "elaborations": [
        {
          "term": "ecosystems",
          "detail": "Population (all members of a species in an area); communities (different populations living together)."
        },
        {
          "term": "energy is needed for life",
          "detail": "Producers, consumers, decomposers in energy pyramids; food chains and food webs."
        },
        {
          "term": "transfer of thermal energy",
          "detail": "Conduction (touching), convection (current), radiation (through space by a wave)."
        }
      ]
    },
    "4": {
      "bigIdeas": [
        "All living things sense and respond to their environment.",
        "Matter has mass, takes up space, and can change phase.",
        "Energy can be transformed.",
        "The motions of Earth and the moon cause observable patterns that affect living and non-living systems."
      ],
      "content": [
        "sensing and responding (humans, animals, plants)",
        "biomes",
        "effect of temperature on particle movement",
        "forms of energy and conservation of energy",
        "devices that transform energy",
        "local changes from Earth's axis, rotation, orbit",
        "effects of relative positions of sun, moon, Earth"
      ],
      "elaborations": [
        {
          "term": "biomes",
          "detail": "Regions grouped by similar temperature/precipitation (climate); terrestrial and aquatic/marine biomes."
        },
        {
          "term": "conservation of energy",
          "detail": "Energy cannot be created or destroyed, only changed (law of conservation of energy)."
        },
        {
          "term": "Earth's axis, rotation, orbit",
          "detail": "Day/night \u2014 nocturnal/diurnal animals; annual seasons \u2014 plants/animals respond by dropping leaves, changing colour."
        }
      ]
    },
    "5": {
      "bigIdeas": [
        "Multicellular organisms have organ systems that enable them to survive and interact within their environment.",
        "Solutions are homogeneous.",
        "Machines are devices that transfer force and energy.",
        "Earth materials change as they move through the rock cycle and can be used as natural resources."
      ],
      "content": [
        "basic structures/functions of body systems (digestive, musculo-skeletal, respiratory, circulatory)",
        "solutions and solubility",
        "properties of simple machines",
        "constructed vs natural machines",
        "power",
        "the rock cycle",
        "local earth materials",
        "First Peoples concepts of interconnectedness",
        "sustainable practices around BC's resources"
      ],
      "elaborations": [
        {
          "term": "simple machines",
          "detail": "Lever, wedge, inclined plane, wheel and axle, pulley, screw; force effects include changing direction and multiplying force."
        },
        {
          "term": "solutions and solubility",
          "detail": "Separated through distillation, evaporation, crystallization; solubility of solids/liquids/gases; concentration, pH."
        },
        {
          "term": "power",
          "detail": "Rate at which energy is transferred (e.g., racing up a hill, machine power ratings, motors)."
        }
      ]
    },
    "6": {
      "bigIdeas": [
        "Multicellular organisms rely on internal systems to survive, reproduce, and interact with their environment.",
        "Everyday materials are often mixtures.",
        "Newton's three laws of motion describe the relationship between force and motion.",
        "The solar system is part of the Milky Way, which is one of billions of galaxies."
      ],
      "content": [
        "body systems (excretory, reproductive, hormonal, nervous)",
        "heterogeneous mixtures",
        "mixture separation methods",
        "Newton's three laws of motion",
        "effects of balanced/unbalanced forces",
        "force of gravity",
        "scale/structure/age of the universe",
        "position, motion, components of our solar system"
      ],
      "elaborations": [
        {
          "term": "Newton's three laws",
          "detail": "1st: objects stay stopped/moving until acted on by outside force. 2nd: only unbalanced force causes acceleration. 3rd: every force has an equal and opposite reaction."
        },
        {
          "term": "separation methods",
          "detail": "Density (centrifuge, settling), particle size (sieves, filters)."
        },
        {
          "term": "components of solar system",
          "detail": "Planets, moons, asteroids, meteors, comets; extreme environments and Canadian exploration technologies (Canadarm, Newt Suit)."
        }
      ]
    },
    "7": {
      "bigIdeas": [
        "Evolution by natural selection provides an explanation for the diversity and survival of living things.",
        "Elements consist of one type of atom, and compounds consist of atoms of different elements chemically combined.",
        "The electromagnetic force produces both electricity and magnetism.",
        "Earth and its climate have changed over geological time."
      ],
      "content": [
        "organisms have evolved over time",
        "survival needs",
        "natural selection",
        "elements and compounds",
        "crystalline structure of solids",
        "chemical changes",
        "electricity generation and electromagnetism",
        "fossil record evidence for biodiversity change",
        "evidence of climate change over geological time"
      ],
      "elaborations": [
        {
          "term": "natural selection",
          "detail": "Traits with greater fitness lead to reproductive advantage; happens within a population over time due to genetic variation."
        },
        {
          "term": "elements vs compounds",
          "detail": "Elements: single type of atom (iron, copper). Compounds: two+ different atoms chemically bonded (water/salt)."
        },
        {
          "term": "electromagnetism",
          "detail": "Moving/changing a magnetic field relative to a wire produces current; current through a wire produces a magnetic field."
        },
        {
          "term": "climate change",
          "detail": "Interconnectedness of plants/animals and environment; changes to harvesting dates, water levels; local First Peoples oral history."
        }
      ]
    },
    "8": {
      "bigIdeas": [
        "Life processes are performed at the cellular level.",
        "The behaviour of matter can be explained by the kinetic molecular theory and atomic theory.",
        "Energy can be transferred as both a particle and a wave.",
        "The theory of plate tectonics is the unifying theory that explains Earth's geological processes."
      ],
      "content": [
        "characteristics of life",
        "cell theory and types of cells",
        "photosynthesis and cellular respiration",
        "relationship of micro-organisms with living things",
        "kinetic molecular theory",
        "atomic theory and models",
        "protons, neutrons, quarks, electrons, leptons",
        "types/effects of electromagnetic radiation",
        "properties/behaviours of light",
        "plate tectonic movement",
        "layers of Earth"
      ],
      "elaborations": [
        {
          "term": "cell theory",
          "detail": "Living things are made of one or more cells; all cells come from pre-existing cells; the cell is the basic unit of life."
        },
        {
          "term": "immune system",
          "detail": "Barrier to infections plus non-specific/specific responses (fever, antibodies, phagocytes, inflammation)."
        },
        {
          "term": "properties of light",
          "detail": "Acts like both wave and particle; wavelength, amplitude, frequency."
        },
        {
          "term": "plate tectonic movement",
          "detail": "Types of plate movements, plate boundaries, earthquakes and volcanoes."
        }
      ]
    },
    "9": {
      "bigIdeas": [
        "Cells are derived from cells.",
        "The electron arrangement of atoms impacts their chemical nature.",
        "Electric current is the flow of electric charge.",
        "The biosphere, geosphere, hydrosphere, and atmosphere are interconnected, as matter cycles and energy flows through them."
      ],
      "content": [
        "asexual reproduction (mitosis)",
        "sexual reproduction (meiosis)",
        "element properties in the periodic table",
        "electron arrangement and compounds formed",
        "circuits \u2014 voltage, current, resistance",
        "effects of solar radiation on matter/energy cycling",
        "matter cycles within ecosystems",
        "sustainability of systems"
      ],
      "elaborations": [
        {
          "term": "mitosis vs meiosis",
          "detail": "Mitosis: pre-existing cells make two identical copies. Meiosis: sex cells formed by dividing a parent cell twice, resulting in four daughter cells."
        },
        {
          "term": "circuits",
          "detail": "Power source, load/resistor, conductor, switch; series/parallel/short circuits; AC vs DC; Ohm's Law (V=IR)."
        },
        {
          "term": "matter cycles",
          "detail": "Water, nitrogen, carbon, phosphorous cycles; human impacts (climate change, deforestation, agriculture); bioaccumulation/biomagnification."
        }
      ]
    }
  }
};

// Maps the subject names used elsewhere in the app (e.g. app/inventories,
// unit_priorities.subject) to the Ministry-style keys used above as
// CURRICULUM_ELABORATIONS object keys. Mirrors lib/bc-curriculum.js's
// SUBJECT_SLUG_MAP so both files agree on what a given app subject name
// means, without forcing every caller to know the Ministry's exact wording.
export const ELABORATIONS_SUBJECT_MAP = {
  'Language Arts': 'English Language Arts',
  'English Language Arts': 'English Language Arts',
  'Mathematics': 'Mathematics',
  'Math': 'Mathematics',
  'Science': 'Science',
  'Social Studies': 'Social Studies',
  'Physical Education': 'Physical Education',
  'Art': 'Arts Education',
  'Music': 'Arts Education',
  'Arts Education': 'Arts Education',
  'French': 'French',
  'Health & Career Education': 'Health & Career Education',
  'Career Education': 'Health & Career Education',
  'Applied Design, Skills & Technologies': 'Applied Design, Skills, and Technologies',
  'Applied Design, Skills, and Technologies': 'Applied Design, Skills, and Technologies',
  'ADST': 'Applied Design, Skills, and Technologies',
}

// K-9 as an ordered scale, K=0 through Grade 9=9, so "2 grades below/above"
// is just index arithmetic. French only has data starting at grade 5 (no
// K-4 French curriculum exists in BC) so it naturally drops out of range
// for younger grade bands - callers should expect possibly-empty results
// for grades a subject doesn't cover, not treat that as a bug.
const GRADE_ORDER = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9']

function gradeIndex(grade) {
  const idx = GRADE_ORDER.indexOf(String(grade).trim().toUpperCase())
  return idx
}

/**
 * Given a subject (app-style name, e.g. "Language Arts") and the grade(s)
 * a teacher's class actually spans (e.g. ['4','5'] for a split class),
 * returns the band of grades to show elaborations for: the selected
 * grades, plus a shrinking buffer below (full gradesBelow for a single
 * selected grade, less as the selection itself spans more grades) and a
 * full gradesAbove buffer above the highest selected grade. Clamped to
 * K-9. Every selected grade is always included in the result.
 *
 * Example: selectedGrades = ['4','5'] -> band = ['3','4','5','6','7']
 * (1 below the lowest selected grade since the 2-grade selection already
 * covers part of the "2 below" buffer, 2 above the highest selected grade).
 * Example: selectedGrades = ['5'] -> band = ['3','4','5','6','7']
 * (full 2 below, full 2 above, since only one grade was selected).
 *
 * Returns null if the subject isn't in ELABORATIONS_SUBJECT_MAP, or if
 * none of the selected grades resolve to a valid K-9 index.
 */
export function getElaborationsForGrades(appSubjectName, selectedGrades, gradesBelow = 2, gradesAbove = 2) {
  const subjectKey = ELABORATIONS_SUBJECT_MAP[appSubjectName]
  if (!subjectKey) return null
  const subjectData = CURRICULUM_ELABORATIONS[subjectKey]
  if (!subjectData) return null

  const grades = (Array.isArray(selectedGrades) ? selectedGrades : [selectedGrades]).filter(Boolean)
  const indices = grades.map(gradeIndex).filter((i) => i >= 0)
  if (indices.length === 0) return null

  const minIdx = Math.min(...indices)
  const maxIdx = Math.max(...indices)
  const span = maxIdx - minIdx + 1 // how many grades the teacher's selection itself spans
  // The "below" buffer shrinks as the selected span widens, so a class that
  // already spans several grades doesn't get an oversized band -- e.g.
  // grades 4+5 selected (span 2) only need 1 extra grade below (grade 3)
  // plus the full 2 above (grade 7), matching Aj's worked example. A
  // single selected grade (span 1) gets the full gradesBelow buffer.
  // This also guarantees every selected grade is always included in the
  // band -- the lower bound never goes above the lowest selected grade.
  const belowBuffer = Math.max(0, gradesBelow - (span - 1))
  const lowIdx = Math.max(0, minIdx - belowBuffer)
  const highIdx = Math.min(GRADE_ORDER.length - 1, maxIdx + gradesAbove)
  const bandGrades = GRADE_ORDER.slice(lowIdx, highIdx + 1)

  // Some subjects (French) don't have data for every grade in K-9 (no K-4
  // French) -- only include grades that actually have data rather than
  // padding with empty entries.
  const entries = bandGrades
    .filter((g) => subjectData[g])
    .map((g) => ({ grade: g, ...subjectData[g] }))

  return {
    subject: subjectKey,
    selectedGrades: grades,
    bandGrades: entries.map((e) => e.grade), // the actual grades with data, in order
    entries,
  }
}

export default CURRICULUM_ELABORATIONS;
