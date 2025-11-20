declare type SteamGame = {
    type: string
    name: string
    steam_appid: number
    required_age: number
    is_free: boolean
    detailed_description: string
    about_the_game: string
    short_description: string
    supported_languages: string
    reviews: string
    header_image: string
    capsule_image: string
    capsule_imagev5: string
    website: string
    pc_requirements: SteamPCRequirements
    mac_requirements: SteamPCRequirements
    linux_requirements: SteamPCRequirements
    legal_notice: string
    developers: string[]
    publishers: string[]
    demos: SteamDemo[]
    price_overview: SteamPriceOverview
    packages: number[]
    package_groups: SteamPackageGroup[]
    platforms: SteamPlatforms
    categories: SteamCategory[]
    genres: SteamGenre[]
    screenshots: SteamScreenshot[]
    movies: SteamMovie[]
    achievements: SteamAchievements
    release_date: SteamReleaseDate
    support_info: SteamSupportInfo
    background: string
    background_raw: string
    content_descriptors: SteamContentDescriptors
    ratings: SteamRatings
}

declare type SteamPCRequirements = {
    minimum: string
}

declare type SteamDemo = {
    appid: number
    description: string
}

declare type SteamPriceOverview = {
    currency: string
    initial: number
    final: number
    discount_percent: number
    initial_formatted: string
    final_formatted: string
}

declare type SteamPackageGroup = {
    name: string
    title: string
    description: string
    selection_text: string
    save_text: string
    display_type: number
    is_recurring_subscription: string
    subs: SteamPackageGroupSub[]
}

declare type SteamPackageGroupSub = {
    packageid: number
    percent_savings_text: string
    percent_savings: number
    option_text: string
    option_description: string
    can_get_free_license: string
    is_free_license: boolean
    price_in_cents_with_discount: number
}

declare type SteamPlatforms = {
    windows: boolean
    mac: boolean
    linux: boolean
}

declare type SteamCategory = {
    id: number
    description: string
}

declare type SteamGenre = {
    id: string
    description: string
}

declare type SteamScreenshot = {
    id: number
    path_thumbnail: string
    path_full: string
}

declare type SteamMovie = {
    id: number
    name: string
    thumbnail: string
    webm: SteamMovieWebm
    mp4: SteamMovieMp4
    dash_av1: string
    dash_h264: string
    hls_h264: string
    highlight: boolean
}

declare type SteamMovieWebm = {
    480: string
    max: string
}

declare type SteamMovieMp4 = {
    480: string
    max: string
}

declare type SteamAchievements = {
    total: number
    highlighted: SteamAchievementsHighlighted[]
}

declare type SteamAchievementsHighlighted = {
    name: string
    path: string
}

declare type SteamReleaseDate = {
    coming_soon: boolean
    date: string
}

declare type SteamSupportInfo = {
    url: string
    email: string
}

declare type SteamContentDescriptors = {
    ids: string[]
    notes: string
}

declare type SteamRatings = {
    [key: string]: {
        rating: string
        descriptors: string
        use_age_gate: string
        required_age: string
        banned?: string
        rating_generated?: string
    }
}