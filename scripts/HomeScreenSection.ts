interface HomeScreenSection {
	// Identification
	id: string;
	name: string;
	caption?: string;
	enabled: boolean;
	order: number;
	category?: string; // Stable category id (custom sections); runtime may force discovery/pinned

	// Display Options
	cardFormat?: "Poster" | "Thumb" | "Backdrop" | "Random";
	spotlight?: boolean; // Legacy: Use renderMode instead. Kept for backward compatibility.
	renderMode?: "Normal" | "Spotlight" | "Random"; // Preferred: Controls rendering mode. "Spotlight" = spotlight section, "Random" = random spotlight/cards, "Normal" = cards only.
	spotlightConfig?: object;
	discoveryEnabled?: boolean;
	flattenSeries?: boolean;
	minimumItems?: number;
	viewMoreUrl?: string;
	captionUrl?: string;
	hidden?: boolean; // legacy, use userConfigurable instead
	hideName?: boolean;

	hideCardTitles?: boolean; // Legacy: use cardTitleVisibility instead
	borderStyle?: string; // Applied as data-border on the section container
	borderColor?: string; // CSS color for card borders (--kefin-card-border-color)
	sectionCssClass?: string; // Extra CSS classes on the section container
	itemsLayout?: "row" | "grid";
	cardTitleVisibility?: "visible" | "hidden";
	cardTitlePosition?: string;
	cardTitleCapitalization?: "normal" | "uppercase" | "lowercase" | "capitalize";
	cardTitleFontFamily?: string;
	cardTitleFontSize?: "small" | "normal" | "large";
	userConfigurable?: boolean; // Whether users can toggle/reorder this section
	useGaplessCards?: boolean; // When true, remove gaps between cards (row or grid)
	useParentCard?: boolean; // When true, use the parent item will be rendered as the card image and link

	// Loads items from an external URL and loads matches from that list from your Jellyfin library
	// Currently supports: mdblist.com only
	externalListUrls?: string[];

	// Multi-Query (only used when queries.length > 1)
	sortBy?: string; // Field to sort merged results by (e.g., 'DatePlayed', 'DateCreated')
	sortOrder?: "Ascending" | "Descending"; // Sort direction for merged results
	minPlayCount?: number; // Minimum play count to include in the section
	maxPlayCount?: number; // Maximum play count to include in the section
	useRandomQuery?: boolean; // Pick one query at load instead of merging; with useMultiQueryPicker, randomizes the initial picker selection
	useMultiQueryPicker?: boolean; // Show a control to pick which query the section displays
	multiQueryPickerLabel?: string; // Fixed label for the picker button; when unset, button shows the selected query name
	useQueryNamesForSection?: boolean; // Use the selected query name in place of the section title

	// Optionally provide pre-defined items to display in the section, instead of using queries
	items?: Array<{
		Name: string;
		Id?: string;
		Type?: string;
		cardFooter?: string;
		imageUrl: string;
		cardUrl: string;
	}>;

	// Query Construction
	queries: Array<Query>;

	// Surface / page kind: home | seasonal | discovery on the home catalog;
	// other pages use series-episodes, search, watchlist, etc. Never "custom".
	type?: string;
	/** True for user-created sections stored in custom groups (surface type still home/seasonal/discovery). */
	isCustom?: boolean;
	/** How a discovery section resolves dynamically: Person, Genre, Studio, Similar, Collection, … */
	discoveryType?: string;
	discoveryItemType?: string;
	discoveryPersonType?: string;
	source?: string;

	/** Pool query used to resolve a dynamic discovery entity (optional on non-discovery sections). */
	discoverySourceQuery?: Query;

	/** Runtime stamp for custom discovery paging (1..N per custom group); not a persisted admin field. */
	pageNumber?: number;

	// Seasonal Config
	startDate?: string;
	endDate?: string;

	// Cache Settings
	ttl?: number;
}

interface Query {
	name?: string; // Optional display name for multi-query picker and section title overrides
	viewMoreUrl?: string; // Optional per-query title link when using multi-query picker
	_sourceType?: "jellyfin" | "cache" | "static";
	path?: string; // Custom endpoint path (e.g., '/Shows/NextUp', '/Shows/Upcoming')
	dataSource?: string; // Cache/custom data source (e.g., 'MoviesCache.getImdbTop250Movies')
	minAge?: number; // Minimum age in days
	maxAge?: number; // Maximum age in days
	queryOptions?: {
		// Query parameters for /Items or custom endpoints
		Ids?: string[];
		IncludeItemTypes?: string[];
		SearchTerm?: string;
		SortBy?: string;
		SortOrder?: "Ascending" | "Descending";
		Limit?: number;
		Filters?: string;
		Genres?: string;
		GenreIds?: string;
		Tags?: string;
		PersonIds?: string;
		Studios?: string;
		StudioIds?: string;
		ParentId?: string;
		ExcludeItemIds?: string;
		Fields?: string;
		[key: string]: any; // Allow additional query params
	};
}

interface HomeScreenSectionGroup {
	author?: string;
	name?: string;
	description?: string;
	sections: Array<HomeScreenSection>;
}

interface SpotlightConfig {
	spotlightLayout: string;
	spotlightSize: string;
	tileCount: number;
	autoPlay: boolean;
	interval: number;
	showDots: boolean;
	showNavButtons: boolean;
	showClearArt: boolean;
	panAnimation: boolean;
	entranceAnimationFirst: string;
	entranceAnimationSecond: string;
	entranceAnimationThird: string;
	slideAnimationFirst: string;
	slideAnimationSecond: string;
	slideAnimationThird: string;
	cycleBackdrops: boolean;
	cycleBackdropsTime?: number; // Legacy: use backdropsCount + interval instead
	backdropsCount?: number;
}

// Used for the customPrefs.kefinTweaks.homeScreen property
// All values are arrays of semi-colon separated strings
interface KefinHomeScreen {
	sections: Array<string>; // id;enabled;order;ttl;cardFormat;animationEnabled;hideName;hideCardTitles;cardTitlePosition;borderStyle;spotlightLayout;spotlightSize;spotlightTileCount;itemsLayout(row|grid; legacy true→grid);cardTitleCapitalization;cardTitleFontFamily;cardTitleFontSize;borderColor;cardTitleColor;useGaplessCards;renderMode(Normal|Spotlight|Random)
	pinnedLists: Array<string>; // name;id1;id2;id3;...
	pinnedParents: Array<string>; // name;id;type
}

/** Non-home layout/appearance prefs (same semicolon section strings as homeScreen.sections). */
interface KefinSectionState {
	sections: Array<string>;
}

/*
User configuration for KefinTweaks Home Screen sections will be stored in the user's custom display preferences as kefinHomeScreen
Additionally, kefinPinnedItems and kefinPinnedParents will store an array of item IDs that the user has pinned to the home screen.
The kefinPinnedItems are individual items intended to appear in a Home Screen Section called "Pinned"
The kefinPinnedParents are parent items that should each have their own Home Screen Section which loads their child items.

For example, a user could pin an MCU collection to their home screen as an item, and it would appear in the Pinned row with the MCU Collection poster.
By contrast, the user could choose to pin the MCU collection as a parent item, which would make the child items of the MCU Collection appear in a section called "MCU Collection".
*/

// An array of these sections is saved to the user's preferences as kefinHomeScreen
// These can be mapped by ID to override the section configuration provided by the server
interface KefinHomeScreenSectionUserConfig {
	id: string;
	enabled?: boolean;
	order?: number;
	ttl?: number;
	cardFormat?: string;
	animationEnabled?: boolean;
	hideName?: boolean;
	hideCardTitles?: boolean;
	cardTitlePosition?: string;
	borderStyle?: string;
	borderColor?: string;
	spotlightLayout?: string;
	spotlightSize?: string;
	spotlightTileCount?: number;
	/** Items layout: row (default) or grid. Replaces legacy gridExpanded. */
	itemsLayout?: "row" | "grid";
	/** @deprecated Prefer itemsLayout; true maps to itemsLayout 'grid' */
	gridExpanded?: boolean;
	/** When true, remove gaps between cards (row or grid). */
	useGaplessCards?: boolean;
	cardTitleCapitalization?: string;
	cardTitleFontFamily?: string;
	cardTitleFontSize?: string;
	/** User override of the section's render mode. */
	renderMode?: "Normal" | "Spotlight" | "Random";
}
