declare type GOGGame = {
    id: number
    title: string
    slug: string
    purchase_link: string
    content_system_compatibility: {
        windows: boolean
        osx: boolean
        linux: boolean
    }
    languages: Record<string, string>
    links: {
        purchase_link: string
        product_card: string
        support: string
        forum: string
    }
    in_development: {
        active: boolean
        until: string | null
    }
    is_secret: boolean
    is_installable: boolean
    game_type: string
    is_pre_order: boolean
    release_date: string
    images: {
        background: string
        logo: string
        logo2x: string
        icon: string
        sidebarIcon: string
        sidebarIcon2x: string
        menuNotificationAv: string
        menuNotificationAv2: string
    }
    dlcs: {
        products: any[]
        all_products_url: string
        expanded_all_products_url: string
    }
    downloads: {
        installers: any[]
        patches: any[]
        language_packs: any[]
        bonus_content: any[]
    }
    expanded_dlcs: any[]
    description: string | GOGDescription
    screenshots: GOGScreenshot[]
    videos: GOGVideo[]
    related_products: any[]
    changelog: string | null
}

declare type GOGDescription = {
    lead: string
    full: string
    whats_cool_about_it: string
}

declare type GOGScreenshot = {
    formatter_template_url: string
    formatted_images: GOGFormattedImage[]
}

declare type GOGFormattedImage = {
    formatter_name: string
    image_url: string
}

declare type GOGVideo = {
    video_url: string
    thumbnail_url: string
    provider: string
}

declare type GOGCatalogSearchResult = {
    pages: number
    currentlyShownProductCount: number
    productCount: number
    products: GOGCatalogProduct[]
    dreamlistGames: any[]
    filters: any
    searchAlgo: string
}

declare type GOGCatalogProduct = {
    id: string
    slug: string
    features: GOGFeature[]
    screenshots: string[]
    userPreferredLanguage?: {
        code: string
        inAudio: boolean
        inText: boolean
    }
    releaseDate: string
    storeReleaseDate: string
    productType: string
    title: string
    coverHorizontal: string
    coverVertical: string
    logo: string
    galaxyBackgroundImage: string
    developers: string[]
    publishers: string[]
    operatingSystems: string[]
    price: GOGPrice
    productState: string
    genres: GOGGenre[]
    tags: GOGTag[]
    reviewsRating: number
    reviewsCount: number
    editions?: GOGEdition[]
    ratings?: GOGRating[]
    storeLink: string
}

declare type GOGPrice = {
    final: string
    base: string
    discount: string | null
    finalMoney: {
        amount: string
        currency: string
        discount: string
    }
    baseMoney: {
        amount: string
        currency: string
    }
}

declare type GOGGenre = {
    name: string
    slug: string
}

declare type GOGTag = {
    name: string
    slug: string
}

declare type GOGEdition = {
    id: number
    name: string
    isRootEdition: boolean
}

declare type GOGRating = {
    name: string
    ageRating: string
}

declare type GOGFeature = {
    name: string
    slug: string
}
