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
      }
        // Add more collections here
    ];

    // Expose to window
    window.KefinCommunityConfig = {
        collections: COMMUNITY_COLLECTIONS
    };

})();

