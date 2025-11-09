# KefinTweaks for Jellyfin

KefinTweaks is a comprehensive collection of enhancements and customizations for Jellyfin, focused on, but not limited to, filling gaps in functionality based on the community's most desired [Feature Requests](https://features.jellyfin.org/?view=most-wanted).  

While working on these scripts to meet my personal needs, I noticed that there was a lot of overlap between the functionality I desire and many of the requested features by the community so I thought it would be a good idea to share this for anyone who may be interested. 

There is no configuration required, but if you wish to customize some of the features, there are options to do so.

I think it's also worth mentioning that before the 1.0 release, you can expect to potentially encounter some issues or bugs. I try to address these as quickly as I can, and I appreciate your time for raising the issues in the first place!

## Table of Contents

- [Installation](#-installation)
  - [Prerequisites](#prerequisites)
  - [Setup Instructions](#setup-instructions)
- [Features Overview](#features-overview)
  - [Data Caching](#data-caching)
  - [Feature Requests Completed](#-feature-requests-completed)
  - [Feature Requests Planned](#-feature-requests-planned)
  - [Core Features](#-core-features)
    - [Watchlist Page](#watchlist-page)
    - [Enhanced Home Screen](#enhanced-home-screen)
    - [Enhanced Search](#enhanced-search)
  - [UI Enhancements](#-ui-enhancements)
    - [Watchlist Support](#watchlist-support)
    - [Skin Manager](#skin-manager)
  - [UX Improvements](#ux-improvements)
    - [Subtitle Search](#subtitle-search)
    - [Remove from Continue Watching](#remove-from-continue-watching)
  - [Navigation Improvements](#navigation-improvements)
    - [Header Tab Enhancements](#header-tab-enhancements)
    - [Breadcrumb Navigation](#breadcrumb-navigation)
    - [Custom Menu Integration](#custom-menu-integration)
    - [Playlist Screen Improvement](#playlist-screen-improvement)
    - [Flatten Single Season Shows](#flatten-single-season-shows)
    - [Collections on Movie/Series Details page](#collections-on-movieseries-details-page)
  - [System Improvements](#-system-improvements)
    - [Performance & Stability](#performance--stability)
    - [Branding & Customization](#branding--customization)
- [Script Details](#-script-details)
  - [Dependency Scripts](#dependency-scripts)
  - [Feature Scripts](#feature-scripts)
- [Auto-Inject Dependencies](#auto-inject-dependencies)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)
- [Support](#-support)
- [Roadmap](#-roadmap)
  - [Planned Features](#planned-features)
  - [Version History](#version-history)

## Installation

### Prerequisites
- Jellyfin 10.10.7 or earlier (10.11.X is untested and "unsupported" but may be mostly functional)
- [JS Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector) plugin installed and configured
- [Custom Tabs](https://github.com/IAmParadox27/jellyfin-plugin-custom-tabs) plugin for watchlist functionality
- [JellyfinEnhanced](https://github.com/n00bcodr/Jellyfin-Enhanced) plugin for Jellyseerr search functionality and ExclusiveElsewhere

### Setup Instructions

0a. **Install Prerequisites listed above**
0b. **If you are using JellyfinEnhanced, you MUST disable the "Watchlist" feature from the plugin settings**
1. **Add a new script to your JS Injector Plugin**
2. **Copy this entire contents of kefinTweaks.js into the new script**

**Optionally update the "scriptRoot" in the KefinTweaks script if you wish to customize and host these scripts yourself.**

3. **Ensure the script is enabled**
4. **Save your changes**

<div align="center">
  <img src="pages/images/injector.png" alt="injector" style="max-width: 100%; height: auto;"/>
</div>  
<br/>  

5. **Required for Watchlist:**  
Add a new tab to your Custom Tabs plugin with the following content:
   ```html
   <div class="sections watchlist"></div>
   ```
<div align="center">
  <img src="pages/images/customtab.png" alt="customtab" style="max-width: 100%; height: auto;"/>
</div>  
<br/>  
<hr>

## Features Overview

KefinTweaks provides a modular system of enhancements that can be individually enabled or disabled based on your needs. Each script is designed to work independently while sharing common utilities and dependencies.

As mentioned above, most of the functionality included in KefinTweaks are features that have been requested by the community. Some of these requests have been pending for 5 years or more. I feel that a lot of the top requests have functionality that is essential to the Jellyfin experience but I have also included less requested features, as well as some things that I just personally needed or wanted.

## Data Caching

One thing that I feel is worth pointing out is the way in which some of the data needed by KefinTweaks is handled. For most of the features, data is grabbed on demand as normal, same as any existing Jellyfin functionality. However there are specific features, or subsets of features which do use local device caching in order to either improve performance, or simply because it is not feasible to fetch the data each time. In the future if this ever becomes a plugin, the caching can be more intelligent and done on the server.

The features in KefinTweaks which use local data caching are listed below, along with accompanying explanations for why they are being cached. Everything is cached by default for 24h unless it is specified otherwise. 
- Home Screen  
  - **Genres** [24h]:  
  Genres are cached simply to reduce API calls to the server. This is not an expensive API call, but under most circumstances the results will be the same even across longer periods of time.
  - **Top People** [24h]:  
  In order to populate the "Top People" in your movie library, we fetch the Person data for every movie in your library. We build a list of all the People who appear in at least X number of items based on their type (Actor/Director/Writer). This is an expensive operation, and is longer as the size of your library grows.
- Watchlist
  - **Watchlist Items** [5m]:  
  This is mostly done to provide a more responsive UX, as typically the API call to retreive these items should not be very expensive. The Watchlist cache is also updated any time there is a change to an item's Play State or Watchlist status.
  - **Series Progress and Movie History** [24h]:  
  These are both more expensive operations, especially if you have watched a very high number of Movies or Shows. It's not practical to fetch this data on demand so we cache it to improve UX.
- Collections on Details Page  
  - **Collections** [24h]:  
  Sadly I know no way to retreive a list of Collections that an Item is a child of from the API directly. The Ancestors endpoint only returns the physical ancestors of an item. In order to be able to populate the "Included In" section, we fetch the children from every Collection in your library and add the Item ID of each child to the cache.

### ✅ **Feature Requests Completed**

- ✅ [Remove items from Continue Watching](https://features.jellyfin.org/posts/517/add-an-option-to-remove-an-item-from-continue-watching)
- ✅ [Watchlist like Netflix](https://features.jellyfin.org/posts/576/watchlist-like-netflix)
- ✅ [Remove pagination in favor of infinite scroll for library pages](https://features.jellyfin.org/posts/216/remove-pagination-use-lazy-loading-for-library-view)
- ✅ [Watched History](https://features.jellyfin.org/posts/633/watched-history)
- ✅ [On-Demand Subtitle Search in Video OSD](https://features.jellyfin.org/posts/3385/on-demand-subtitle-search)
- ✅ [Add genres and recommendations to home screen](https://features.jellyfin.org/posts/3501/add-genres-and-recommendations-to-home-screen)
- ✅ [Improved Playlist UX](https://features.jellyfin.org/posts/2823/playlist-moviesummary)
- ✅ [Flattening TV Shows with 1 season](https://features.jellyfin.org/posts/8/flattening-tv-shows) [[2]](https://features.jellyfin.org/posts/3352/add-option-to-flatten-single-season-tv-shows-skip-season-level)
- ✅ [List all collections that an item belongs to on the details page](https://features.jellyfin.org/posts/540/list-all-collections-that-a-movie-belong-to-in-movie-details) [[2]](https://features.jellyfin.org/posts/3540/collection-data-present-on-content-within-the-collection)
- ✅ [Custom Skins/Themes](https://features.jellyfin.org/posts/2509/themes-skins-or-clone-plex-layout-to-convert-the-rest-of-the-plex-and-emby-user-base-to-jellyfin) [[2]](https://features.jellyfin.org/posts/2616/theme-skins)
- ✅ [TV Season Selection at the Series level](https://forum.jellyfin.org/t-tv-season-selection-when-browsing-seasons)

### 🚧 **Feature Requests Planned**

- 🚧 [Add end time to detail page for entire shows and seasons](https://features.jellyfin.org/posts/3470/add-info-ends-at-hh-mm-for-each-season-and-whole-show)
- 🚧 [Keep original title option](https://features.jellyfin.org/posts/32/keep-original-title-option)
- 🚧 [Search by tag/genre](https://features.jellyfin.org/posts/276/search-by-tag-genre)
- 🚧 [Add drag and drop to library order](https://features.jellyfin.org/posts/3509/add-drag-and-drop-to-libray-order)
<hr>

### Core Features

#### **Watchlist Page**
- **Watchlist**:  
Tired of forgetting everything you wanted to watch? Add movies, series, seasons, and episodes to your Watchlist!  

<div align="center">
  <img src="pages/images/watchlist.png" alt="watchlist" style="max-width: 100%; height: auto;"/>
</div>  
<br/>  

- **Series Progress**:  
An overview of every series you've ever started watching with functionality to filter, sort and mark items as watched.  

<div align="center">
  <img src="pages/images/progress.png" alt="progress" style="max-width: 100%; height: auto;"/>
</div>  
<br/>  

- **Movie History**:  
An overview of every movie you've ever watched with functionality to filter, sort and mark items as favorites.  

<div align="center">
  <img src="pages/images/history.png" alt="history" style="max-width: 100%; height: auto;"/>
</div>  
<br/>  

- **Statistics**:  
A summary of your watched items by the numbers. See how many movies, shows or episodes you have watched.  

<div align="center">
  <img src="pages/images/statistics.png" alt="statistics" style="max-width: 100%; height: auto;"/>
</div>

- **Auto-Remove**:  
Automatically removes watched items from your watchlist when playback completes.  

- **Real-time Updates**:  
Cached watchlist updates when toggling watchlist status from card overlays  
<hr>


#### **Enhanced Home Screen**
- **Custom Sections**:  
Add playlist or collection-based sections to your home screen  

- **New & Trending**:  
Creates sections for movies and episodes released in the last 7 days (trending sections incomplete)  

- **Infinite Discovery Sections**:  
Load discovery sections based on items you've watched and favorited, as well as from genres or top people in your library  

- **Seasonal Content**:  
Seasonally-themed sections (Halloween, Christmas, etc.)  

<div align="center">
  <img src="pages/images/seasonalsection.png" alt="homescreen" style="max-width: 100%; height: auto;"/>
</div>  
<br/>  

- **Watchlist Integration**:  
Dedicated watchlist section on home screen  

<div align="center">
  <img src="pages/images/homescreen.png" alt="homescreen" style="max-width: 100%; height: auto;"/>
</div>  
<br/>  

#### **Enhanced Search**
- **Performance Improvements**:  
Defaults to searching in Movies/TV/People as most searches are for these items. Options to search specific categories or all categories like the default Jellyfin search functionality.  

- **Jellyseerr Support**:  
Zero-config support for Jellyseerr results if [JellyfinEnhanced](https://github.com/n00bcodr/Jellyfin-Enhanced) is installed  

- **Meilisearch Support**:  
Zero-config support for searching with the [Meilisearch](https://github.com/arnesacnussem/jellyfin-plugin-meilisearch) plugin  

<div align="center">
  <img src="pages/images/search.png" alt="search" style="max-width: 100%; height: auto;"/>
</div>  
<br/>
<hr>

### UI Enhancements

#### **Watchlist Support**
- **Watchlist Toggle**:  
Watchlist toggle button added to all item card overlays  

<div align="center">
  <img src="pages/images/watchlistoverlay.png" alt="watchlistoverlay" style="max-width: 100%; height: auto;"/>
</div>  
<br/>  
<hr>


#### **Skin Manager**

The Skin Manager adds the functionality for users to change the appearance of the Web UI from a button in the top header, or from their Display Preferences in their User Account.

<table align="center" style="width: 100%;">
  <tr>
    <th style="text-align:center; width: 44.2%;">Top Header Button</th>
    <th style="text-align:center;">User Display Preferences</th>
  </tr>
  <tr>
    <td style="width: 35%;"><img src="pages/images/appearanceheader.png" width="1000"/></td>
    <td style="width: 65%;"><img src="pages/images/appearanceusersettings.png" width="1000"/></td>
  </tr>
</table>
<br/>  

- **Skins**  
Select from a list of pre-defined Skins created by other Jellyfin community members. You may specify additional custom skins in the configuration options.

- **Color Schemes**  
Certain Skins either support or require a color scheme. This lets you change the UI colors within an individual Skin. These options are automatically available for the Skins which support them.
<hr>

### UX Improvements

#### **Subtitle Search**:  
Search and download subtitles directly from the video OSD  

<div align="center">
  <img src="pages/images/subtitlesearch.png" alt="subtitlesearch" style="max-width: 100%; height: auto;"/>
</div>  
<br/>  

#### **Remove from Continue Watching**:  
Adds a card overlay button to remove items from Continue Watching for all resumable items  

<div align="center">
  <img src="pages/images/continuewatching.png" alt="continuewatching" style="max-width: 100%; height: auto;"/>
</div>  
<br/>  

### Navigation Improvements

#### **Header Tab Enhancements**:  
Improved tab navigation and functionality, supports linking to specific tabs  

#### **Breadcrumb Navigation**:  
Clear navigation paths for Movies, Series, Seasons, Episodes, Music Artists, Albums and Songs

<div align="center">
  <img src="pages/images/breadcrumbs.png" alt="breadcrumbs" style="max-width: 100%; height: auto;"/>
</div>  
<br/>  

#### **Custom Menu Integration**:  
Add custom menu links to the side navigation drawer menu  

<div align="center">
  <img src="pages/images/custommenu.png" alt="custommenu" style="max-width: 100%; height: auto;"/>
</div>  
<br/>  

#### **Playlist Screen Improvement**:  
Updates the default playlist functionality to include a play button to start playback and make clicking an item go to the item detail page  

#### **Flatten Single Season Shows**:  
This will display the list of episodes from the first season on the Series details page for Shows which only have 1 season.  

<div align="center">
  <img src="pages/images/flattenshows.png" alt="flattenshows" style="max-width: 100%; height: auto;"/>
</div>  
<br/>  

#### **Collections on Movie/Series Details page**:  
This shows an "Included In" section on the Item Details page which displays any Collections that the item is a part of.  

<div align="center">
  <img src="pages/images/itemdetailscollections.png" alt="itemdetailscollections" style="max-width: 100%; height: auto;"/>
</div>  
<br/>  
<hr>


### System Improvements

#### **Performance & Stability**
- **Background Leak Fix**:  
    Resolves an issue that causes backgrounds to be added to the DOM endlesslly when a tab is not focused and Backdrop images are enabled  

- **Infinite Scroll**:  
    Adds infinite scrolling to the Movies and TV library pages. Loads batches of 100 items at a time and supports filtering and sorting.  

- **LocalStorage Caching**:  
    Local caching for data related to Watchlist, Series Progress, Movie History and Top People  

- **Dashboard Button Fix**:  
    Fix to handle navigating back from the dashboard page to the homescreen instead of the "new tab" page of a browser  

#### **Branding & Customization**
- **Exclusive Elsewhere**:  
Custom branding for items which aren't available on any external streaming providers. Requires [JellyfinEnhanced](https://github.com/n00bcodr/Jellyfin-Enhanced).  

- **Ratings and Comments**:  
Coming soon...requires the [Updoot](https://github.com/BobHasNoSoul/jellyfin-updoot) backend script  
<hr>


## Script Details

### Dependency Scripts

| Script | Description |
|--------|-------------|
| `utils.js` | Page view management and common utilities |
| `cardBuilder.js` | Enhanced card building functionality |
| `localStorageCache.js` | Caching layer with TTL management |
| `indexedDBCache.js` | IndexedDB-based caching for large datasets |
| `modal.js` | Generic modal system for dialogs |
| `toaster.js` | Toast notification system |
| `userConfig.js` | User-specific configuration for skins and settings |

### Feature Scripts

| Script | Description | Dependencies |
|--------|-------------|--------------|
| `watchlist.js` | Complete watchlist management system | `cardBuilder`, `localStorageCache`, `modal`, `utils` |
| `homeScreen.js` | Custom home screen sections | `cardBuilder`, `localStorageCache`, `utils` |
| `search.js` | Enhanced search functionality | `cardBuilder`, `utils` |
| `headerTabs.js` | Header tab improvements | None |
| `customMenu.js` | Custom menu link handling | `utils` |
| `exclusiveElsewhere.js` | Custom branding for unavailable content | None |
| `updoot.js` | Upvote functionality integration | None |
| `backdropLeakFix.js` | Memory leak fixes | None |
| `dashboardButtonFix.js` | Dashboard button behavior fix | None |
| `infiniteScroll.js` | Infinite scroll functionality | `cardBuilder` |
| `removeContinue.js` | Remove continue watching functionality | None |
| `subtitleSearch.js` | Subtitle search in video OSD | `toaster` |
| `breadcrumbs.js` | Breadcrumb navigation | `utils` |
| `playlist.js` | Playlist view enhancements | `cardBuilder`, `utils` |
| `itemDetailsCollections.js` | Collections display on item details pages | `indexedDBCache`, `utils`, `cardBuilder` |
| `flattenSingleSeasonShows.js` | Flatten single-season shows to show episodes directly | `cardBuilder`, `utils` |
| `skinManager.js` | Skin selection and management | `utils`, `userConfig` |
<br>

## Auto-Inject Dependencies

KefinTweaks automatically enables required dependencies when you enable a script that needs them. For example:

- Enabling `watchlist` automatically enables `cardBuilder`, `localStorageCache`, `modal`, and `utils`

This ensures all scripts have their required dependencies without manual configuration.
<hr>

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.  

## Acknowledgments

- **Jellyfin Team**: For the amazing media server platform
- **[n00bcodr](https://github.com/n00bcodr)**: For JellyfinEnhanced, the JS Injector Plugin and moral support
- **[IAmParadox27](https://github.com/IAmParadox27)**: For the Custom Tabs Plugin
- **[BobHasNoSoul](https://github.com/BobHasNoSoul)**: For the jellyfin-updoot functionality
- **[The Jellyfin Community](https://discord.gg/v7P9CAvCKZhttps://discord.gg/v7P9CAvCKZ)**: For sharing knowledge and providing a welcoming enviornment to ask questions and learn 

## Support

- **Issues**:  
KefinTweaks is not maintained by the Jellyfin team, and as a result you are encouraged to seek support from me directly. Sadly, there is no place suitable for discussion of plugins built by community members or fan-made projects in the official Jellyfin Discord, so please visit the [Jellyfin Community Discord](https://discord.gg/v7P9CAvCKZhttps://discord.gg/v7P9CAvCKZ) to find me (username: HighImKevin) and other users who would be happy to help you out. Please also feel free to report bugs and request features from the Issues page.  

- **Documentation**:  
This README and the inline comments in kefinTweaks.js and the other scripts is the only real documentation available at this time  
<hr>

## Roadmap

### Planned Features
- **Jellyfin 10.11 Support**:  

- **UI Configuration**:  
Allow admins to customize the configuration through the UI instead of the JS script  
Allow users to also customize various configuration options through the UI
<hr>

### Version History
- **v0.2.0**: New Features: Skin Manager, Collections on Details Page, Flatten TV Shows
- **v0.1.3**: Improve Watchlist UI and Search UX
- **v0.1.2**: Added proper support for Base URLs configured in Jellyfin
- **v0.1.1**: Fixes for Watchlist UI elements and performance improvements for Watchlist and Search
- **v0.1.0**: Initial release for Jellyfin 10.10.7
