import { registerFragment } from 'meteor/vulcan:core';



registerFragment(`
  fragment PostsBase on Post {
    # Core fields
    _id
    title
    url
    slug
    postedAt
    createdAt
    modifiedAt
    sticky
    metaSticky
    status
    frontpageDate
    meta
    draft
    deletedDraft
    viewCount
    clickCount
    
    commentCount
    voteCount
    baseScore
    unlisted
    score
    feedId
    feedLink
    lastVisitedAt
    isRead
    lastCommentedAt
    canonicalCollectionSlug
    curatedDate
    commentsLocked

    # questions
    question
    hiddenRelatedQuestion

    # vulcan:users
    userId
    
    # Local Event data
    groupId
    location
    googleLocation
    mongoLocation
    startTime
    endTime
    localStartTime
    localEndTime
    facebookLink
    website
    contactInfo
    isEvent
    types

    # Review data 
    reviewedByUserId
    suggestForCuratedUserIds
    suggestForCuratedUsernames
    reviewForCuratedUserId
    authorIsUnreviewed

    # Alignment Forum
    af
    afDate
    suggestForAlignmentUserIds
    reviewForAlignmentUserId
    afBaseScore
    afCommentCount
    afLastCommentedAt
    afSticky
    
    isFuture
    hideAuthor
    moderationStyle
    hideCommentKarma
    submitToFrontpage
    shortform
    canonicalSource

    shareWithUsers
    
    nominationCount2018
    reviewCount2018

    group {
      _id
      name
    }
  }
`);

registerFragment(`
  fragment PostsAuthors on Post {
    user {
      ...UsersMinimumInfo
      
      # Author moderation info
      moderationStyle
      bannedUserIds
      moderatorAssistance
    }
    coauthors {
      ...UsersMinimumInfo
    }
  }
`);

registerFragment(`
  fragment PostsDetails on Post {
    ...PostsBase
    ...PostsAuthors

    # Sort settings
    commentSortOrder
    
    # Sequence navigation
    collectionTitle
    canonicalPrevPostSlug
    canonicalNextPostSlug
    canonicalCollectionSlug
    canonicalSequenceId
    canonicalBookId
    canonicalSequence {
      title
    }
    canonicalBook {
      title
    }
    canonicalCollection {
      title
    }

    # Moderation stuff
    showModerationGuidelines
    moderationGuidelines {
      version
      html
    }
    customHighlight {
      version
      html
    }
    bannedUserIds
    hideAuthor
    moderationStyle
    
    # Voting
    voteCount
    currentUserVotes{
      ...VoteFragment
    }
    feed {
      ...RSSFeedMinimumInfo
    }
    sourcePostRelations {
      _id
      sourcePostId
      sourcePost {
        ...PostsBase
        ...PostsAuthors
      }
      order
    }
    targetPostRelations {
      _id
      sourcePostId
      targetPostId
      targetPost {
        ...PostsBase
        ...PostsAuthors
      }
      order
    }
  }
`);

// Same as PostsPage, with added just optional arguments to the content field
registerFragment(`
  fragment PostsRevision on Post {
    ...PostsDetails

    # Content & Revisions
    version
    contents(version: $version) {
      ...RevisionDisplay
    }
    revisions {
      version
      editedAt
    }
  }
`)

registerFragment(`
  fragment PostsRevisionEdit on Post {
    ...PostsDetails

    # Content & Revisions
    version
    contents(version: $version) {
      ...RevisionEdit
    }
    revisions {
      version
      editedAt
    }
  }
`)

registerFragment(`
  fragment PostsWithNavigationAndRevision on Post {
    ...PostsRevision
    ...PostSequenceNavigation
    
    tableOfContentsRevision(version: $version)
  }
`)

registerFragment(`
  fragment PostsWithNavigation on Post {
    ...PostsPage
    ...PostSequenceNavigation
    
    tableOfContents
  }
`)

// This is a union of the fields needed by PostsTopNavigation and BottomNavigation.
registerFragment(`
  fragment PostSequenceNavigation on Post {
    # Prev/next sequence navigation
    sequence(sequenceId: $sequenceId) {
      _id
      title
    }
    prevPost(sequenceId: $sequenceId) {
      _id
      title
      slug
      commentCount
      baseScore
      sequence(sequenceId: $sequenceId) {
        _id
      }
    }
    nextPost(sequenceId: $sequenceId) {
      _id
      title
      slug
      commentCount
      baseScore
      sequence(sequenceId: $sequenceId) {
        _id
      }
    }
  }
`)

registerFragment(`
  fragment PostsPage on Post {
    ...PostsDetails
    version
    contents {
      ...RevisionDisplay
    }
  }
`)

registerFragment(`
  fragment PostsEdit on Post {
    ...PostsPage
    moderationGuidelines {
      ...RevisionEdit
    }
    contents {
      ...RevisionEdit
    }
    customHighlight {
      ...RevisionEdit
    }
    tableOfContents
  }
`);

registerFragment(`
  fragment EditModerationGuidelines on Post {
    moderationGuidelines {
      ...RevisionEdit
    },
    moderationStyle
  }
`)

registerFragment(`
  fragment PostsRevisionsList on Post {
    _id
    revisions {
      version
      editedAt
    }
  }
`)


registerFragment(`
  fragment PostsList on Post {
    ...PostsBase
    ...PostsAuthors
    originalPostRelationSourceId
    contents {
      htmlHighlight
      wordCount
    }
    moderationGuidelines {
      ...RevisionDisplay
    }
    customHighlight {
      ...RevisionDisplay
    }
  }
`);

registerFragment(`
  fragment PostsRecentDiscussion on Post {
    ...PostsList
    recentComments(commentsLimit: $commentsLimit, maxAgeHours: $maxAgeHours, af: $af) {
      ...CommentsList
    }
  }
`);

registerFragment(`
  fragment UsersBannedFromPostsModerationLog on Post {
    user {
      ...UsersMinimumInfo
    }
    title
    slug
    _id
    bannedUserIds
  }
`)