// KefinTweaks Community Home Screen Sections
// This file contains curated collections of home screen sections submitted by the community.
// Submit your own: [URL Placeholder]

(function() {
    'use strict';

    const COMMUNITY_COLLECTIONS = [
      {
        "name": "Based on Your Watched History [Discovery]",
        "author": "HighImKevin",
        "sections": [
          {
            "name": "Movies You Forgot About",
            "enabled": true,
            "order": 22,
            "discoveryEnabled": true,
            "renderMode": "Normal",
            "cardFormat": "Poster",
            "queries": [
              {
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "SortBy": "PlayCount",
                  "SortOrder": "Descending",
                  "Filters": "IsResumable",
                  "Limit": 20
                }
              }
            ],
            "flattenSeries": false,
            "id": "custom-1768607068997",
            "type": "custom"
          },
          {
            "name": "Best Movies You've Never Seen",
            "enabled": true,
            "order": 100,
            "discoveryEnabled": true,
            "renderMode": "Normal",
            "cardFormat": "Poster",
            "queries": [
              {
                "queryOptions": {
                  "IsUnplayed": true,
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Descending",
                  "Limit": 20,
                  "MinCommunityRating": 9
                }
              }
            ],
            "flattenSeries": false,
            "id": "custom-1769640868950",
            "type": "custom"
          },
          {
            "name": "Rewatch One Of Your Favorites",
            "enabled": true,
            "order": 100,
            "discoveryEnabled": true,
            "renderMode": "Normal",
            "cardFormat": "Poster",
            "queries": [
              {
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsFavorite",
                  "Limit": 20
                }
              }
            ],
            "flattenSeries": false,
            "id": "custom-1769644637599",
            "type": "custom"
          }
        ]
      },
      {
        "name": "Multi Query Examples",
        "author": "HighImKevin",
        "description": "Custom section examples that use the multi-query picker.",
        "sections": [
          {
            "id": "custom-1791197522382",
            "name": "Our Top Movie Choices",
            "enabled": true,
            "order": 100,
            "category": "none",
            "cardFormat": "Poster",
            "ttl": 86400000,
            "queries": [
              {
                "name": "Best of Action",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "Genres": "Action",
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 50,
                  "MinCommunityRating": 7.5
                }
              },
              {
                "name": "Best of Comedy",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "Genres": "Comedy",
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 50,
                  "MinCommunityRating": 7.5
                }
              },
              {
                "name": "Best of Drama",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "Genres": "Drama",
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 50,
                  "MinCommunityRating": 7.5
                }
              },
              {
                "name": "Best of Horror",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "Genres": "Horror",
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 50,
                  "MinCommunityRating": 7.5
                }
              },
              {
                "name": "Best of Science Fiction",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "Genres": "Science Fiction",
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 50,
                  "MinCommunityRating": 7.5
                }
              },
              {
                "name": "Best of Romance",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "Genres": "Romance",
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 50,
                  "MinCommunityRating": 7.5
                }
              }
            ],
            "userConfigurable": true,
            "renderMode": "Normal",
            "discoveryEnabled": false,
            "type": "home",
            "useRandomQuery": true,
            "useMultiQueryPicker": true,
            "isCustom": true,
            "description": "Our top offerings by genre",
            "useGaplessCards": false,
            "useParentCard": false,
            "itemLimit": 16,
            "useQueryNamesForSection": false
          },
          {
            "id": "custom-1791256768605",
            "name": "Movies by the Decade",
            "enabled": false,
            "order": 100,
            "category": "none",
            "cardFormat": "Poster",
            "ttl": 86400000,
            "queries": [
              {
                "name": "50s Movies",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "1950",
                    "1951",
                    "1952",
                    "1953",
                    "1954",
                    "1955",
                    "1956",
                    "1957",
                    "1958",
                    "1959"
                  ]
                }
              },
              {
                "name": "60s Movies",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "1960",
                    "1961",
                    "1962",
                    "1963",
                    "1964",
                    "1965",
                    "1966",
                    "1967",
                    "1968",
                    "1969"
                  ]
                }
              },
              {
                "name": "70s Movies",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "1970",
                    "1971",
                    "1972",
                    "1973",
                    "1974",
                    "1975",
                    "1976",
                    "1977",
                    "1978",
                    "1979"
                  ]
                }
              },
              {
                "name": "80s Movies",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "1980",
                    "1981",
                    "1982",
                    "1983",
                    "1984",
                    "1985",
                    "1986",
                    "1987",
                    "1988",
                    "1989"
                  ]
                }
              },
              {
                "name": "90s Movies",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "1990",
                    "1991",
                    "1992",
                    "1993",
                    "1994",
                    "1995",
                    "1996",
                    "1997",
                    "1998",
                    "1999"
                  ]
                }
              },
              {
                "name": "2000s Movies",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "2000",
                    "2001",
                    "2002",
                    "2003",
                    "2004",
                    "2005",
                    "2006",
                    "2007",
                    "2008",
                    "2009"
                  ]
                }
              },
              {
                "name": "2010s Movies",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "2010",
                    "2011",
                    "2012",
                    "2013",
                    "2014",
                    "2015",
                    "2016",
                    "2017",
                    "2018",
                    "2019"
                  ]
                }
              },
              {
                "name": "2020s Movies",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "2020",
                    "2021",
                    "2022",
                    "2023",
                    "2024",
                    "2025",
                    "2026",
                    "2027",
                    "2028",
                    "2029"
                  ]
                }
              }
            ],
            "caption": "Browse by decade",
            "userConfigurable": true,
            "renderMode": "Normal",
            "discoveryEnabled": false,
            "type": "home",
            "useRandomQuery": true,
            "useMultiQueryPicker": true,
            "multiQueryPickerLabel": "Pick a Decade",
            "useQueryNamesForSection": true,
            "isCustom": true,
            "description": "Find something to watch from your favorite decade",
            "useGaplessCards": false,
            "useParentCard": false
          },
          {
            "id": "custom-1791256768606",
            "name": "Our Top Series Choices",
            "enabled": true,
            "order": 100,
            "category": "none",
            "cardFormat": "Poster",
            "ttl": 86400000,
            "queries": [
              {
                "name": "Best of Action",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "Genres": "Action",
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 50,
                  "MinCommunityRating": 7.5
                }
              },
              {
                "name": "Best of Comedy",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "Genres": "Comedy",
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 50,
                  "MinCommunityRating": 7.5
                }
              },
              {
                "name": "Best of Drama",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "Genres": "Drama",
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 50,
                  "MinCommunityRating": 7.5
                }
              },
              {
                "name": "Best of Horror",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "Genres": "Horror",
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 50,
                  "MinCommunityRating": 7.5
                }
              },
              {
                "name": "Best of Science Fiction",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "Genres": "Science Fiction",
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 50,
                  "MinCommunityRating": 7.5
                }
              },
              {
                "name": "Best of Romance",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "Genres": "Romance",
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 50,
                  "MinCommunityRating": 7.5
                }
              }
            ],
            "userConfigurable": true,
            "renderMode": "Normal",
            "discoveryEnabled": false,
            "type": "home",
            "useRandomQuery": true,
            "useMultiQueryPicker": true,
            "isCustom": true,
            "description": "Our top series offerings by genre",
            "useGaplessCards": false,
            "useParentCard": false,
            "itemLimit": 16,
            "useQueryNamesForSection": false
          },
          {
            "id": "custom-1791256768607",
            "name": "Series by the Decade",
            "enabled": false,
            "order": 100,
            "category": "none",
            "cardFormat": "Poster",
            "ttl": 86400000,
            "queries": [
              {
                "name": "50s Series",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "1950",
                    "1951",
                    "1952",
                    "1953",
                    "1954",
                    "1955",
                    "1956",
                    "1957",
                    "1958",
                    "1959"
                  ]
                }
              },
              {
                "name": "60s Series",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "1960",
                    "1961",
                    "1962",
                    "1963",
                    "1964",
                    "1965",
                    "1966",
                    "1967",
                    "1968",
                    "1969"
                  ]
                }
              },
              {
                "name": "70s Series",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "1970",
                    "1971",
                    "1972",
                    "1973",
                    "1974",
                    "1975",
                    "1976",
                    "1977",
                    "1978",
                    "1979"
                  ]
                }
              },
              {
                "name": "80s Series",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "1980",
                    "1981",
                    "1982",
                    "1983",
                    "1984",
                    "1985",
                    "1986",
                    "1987",
                    "1988",
                    "1989"
                  ]
                }
              },
              {
                "name": "90s Series",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "1990",
                    "1991",
                    "1992",
                    "1993",
                    "1994",
                    "1995",
                    "1996",
                    "1997",
                    "1998",
                    "1999"
                  ]
                }
              },
              {
                "name": "2000s Series",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "2000",
                    "2001",
                    "2002",
                    "2003",
                    "2004",
                    "2005",
                    "2006",
                    "2007",
                    "2008",
                    "2009"
                  ]
                }
              },
              {
                "name": "2010s Series",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "2010",
                    "2011",
                    "2012",
                    "2013",
                    "2014",
                    "2015",
                    "2016",
                    "2017",
                    "2018",
                    "2019"
                  ]
                }
              },
              {
                "name": "2020s Series",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Filters": "IsUnplayed",
                  "Limit": 20,
                  "Years": [
                    "2020",
                    "2021",
                    "2022",
                    "2023",
                    "2024",
                    "2025",
                    "2026",
                    "2027",
                    "2028",
                    "2029"
                  ]
                }
              }
            ],
            "caption": "Browse by decade",
            "userConfigurable": true,
            "renderMode": "Normal",
            "discoveryEnabled": false,
            "type": "home",
            "useRandomQuery": true,
            "useMultiQueryPicker": true,
            "multiQueryPickerLabel": "Pick a Decade",
            "useQueryNamesForSection": true,
            "isCustom": true,
            "description": "Find a series from your favorite decade",
            "useGaplessCards": false,
            "useParentCard": false
          }
        ]
      },
      {
        "name": "Prolific People [Discovery]",
        "author": "HighImKevin",
        "description": "Discovery sections featuring prolific movie people, plus top series actors.",
        "sections": [
          {
            "name": "Prolific Movie Writers",
            "enabled": true,
            "order": 100,
            "discoveryEnabled": true,
            "renderMode": "Normal",
            "cardFormat": "Poster",
            "queries": [
              {
                "dataSource": "PeopleCache.getTopWriters",
                "dataSourceOptions": {
                  "ItemType": "Movie"
                },
                "queryOptions": {
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Limit": 20
                }
              }
            ],
            "flattenSeries": false,
            "id": "custom-1770810264918",
            "type": "custom"
          },
          {
            "name": "Prolific Movie Directors",
            "enabled": true,
            "order": 100,
            "discoveryEnabled": true,
            "renderMode": "Normal",
            "cardFormat": "Poster",
            "queries": [
              {
                "dataSource": "PeopleCache.getTopDirectors",
                "dataSourceOptions": {
                  "ItemType": "Movie"
                },
                "queryOptions": {
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Limit": 20
                }
              }
            ],
            "flattenSeries": false,
            "id": "custom-1770810234128",
            "type": "custom"
          },
          {
            "name": "Prolific Movie Actors",
            "enabled": true,
            "order": 250,
            "discoveryEnabled": true,
            "renderMode": "Normal",
            "cardFormat": "Poster",
            "queries": [
              {
                "dataSource": "PeopleCache.getTopActors",
                "dataSourceOptions": {
                  "ItemType": "Movie"
                },
                "queryOptions": {
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Limit": 20
                }
              }
            ],
            "flattenSeries": false,
            "id": "custom-1768973523242",
            "type": "custom"
          },
          {
            "name": "Prolific Series Actors",
            "enabled": true,
            "order": 250,
            "discoveryEnabled": true,
            "renderMode": "Normal",
            "cardFormat": "Poster",
            "queries": [
              {
                "dataSource": "PeopleCache.getTopActors",
                "dataSourceOptions": {
                  "ItemType": "Series"
                },
                "queryOptions": {
                  "SortBy": "Random",
                  "SortOrder": "Ascending",
                  "Limit": 20
                }
              }
            ],
            "flattenSeries": false,
            "id": "custom-1791300000001",
            "type": "custom"
          }
        ]
      }
      // Add more collections here
    ];

    // Expose to window
    window.KefinCommunityConfig = {
        collections: COMMUNITY_COLLECTIONS
    };

})();

