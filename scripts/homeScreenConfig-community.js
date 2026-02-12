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
        "name": "Genre Sections",
        "author": "HighImKevin",
        "sections": [
          {
            "name": "Popular Movie Genres",
            "enabled": true,
            "order": 22,
            "discoveryEnabled": false,
            "renderMode": "Normal",
            "cardFormat": "Thumb",
            "queries": [
              {
                "path": "/Genres",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Movie"
                  ],
                  "SortBy": "ChildCount",
                  "SortOrder": "Descending",
                  "Limit": 20
                }
              }
            ],
            "flattenSeries": false,
            "id": "custom-1768961093582",
            "ttl": 86400000,
            "type": "custom"
          },
          {
            "name": "Popular TV Genres",
            "enabled": true,
            "order": 100,
            "discoveryEnabled": false,
            "renderMode": "Normal",
            "cardFormat": "Thumb",
            "queries": [
              {
                "path": "/Genres",
                "queryOptions": {
                  "IncludeItemTypes": [
                    "Series"
                  ],
                  "SortBy": "ChildCount",
                  "SortOrder": "Descending",
                  "Limit": 20
                }
              }
            ],
            "flattenSeries": false,
            "id": "custom-1770808132827",
            "ttl": 86400000,
            "type": "custom"
          }
        ]
      },
      {
        "name": "Prolific People [Discovery]",
        "author": "HighImKevin",
        "sections": [
          {
            "name": "Prolific Writers",
            "enabled": true,
            "order": 100,
            "discoveryEnabled": true,
            "renderMode": "Normal",
            "cardFormat": "Poster",
            "queries": [
              {
                "dataSource": "PeopleCache.getTopWriters",
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
            "name": "Prolific Directors",
            "enabled": true,
            "order": 100,
            "discoveryEnabled": true,
            "renderMode": "Normal",
            "cardFormat": "Poster",
            "queries": [
              {
                "dataSource": "PeopleCache.getTopDirectors",
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
            "name": "Prolific Actors",
            "enabled": true,
            "order": 250,
            "discoveryEnabled": true,
            "renderMode": "Normal",
            "cardFormat": "Poster",
            "queries": [
              {
                "dataSource": "PeopleCache.getTopActors",
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

