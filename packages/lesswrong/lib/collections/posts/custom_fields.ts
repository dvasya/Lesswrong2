import GraphQLJSON from 'graphql-type-json';
import moment from 'moment';
import * as _ from 'underscore';
import { schemaDefaultValue } from '../../collectionUtils';
import { makeEditable } from '../../editor/make_editable';
import { forumTypeSetting } from '../../instanceSettings';
import { getWithLoader } from '../../loaders';
import { accessFilterMultiple, accessFilterSingle, addFieldsDict, arrayOfForeignKeysField, denormalizedCountOfReferences, denormalizedField, foreignKeyField, googleLocationToMongoLocation, resolverOnlyField } from '../../utils/schemaUtils';
import { Utils } from '../../vulcan-lib';
import { localGroupTypeFormOptions } from '../localgroups/groupTypes';
import { userOwns } from '../../vulcan-users/permissions';
import { userCanCommentLock, userCanModeratePost } from '../users/helpers';
import { Posts } from './collection';
import { sequenceGetNextPostID, sequenceGetPrevPostID, sequenceContainsPost } from '../sequences/helpers';
import { postCanEditHideCommentKarma } from './helpers';
import { captureException } from '@sentry/core';

const frontpageDefault = forumTypeSetting.get() === "EAForum" ? () => new Date() : undefined

export const formGroups = {
  default: {
    name: "default",
    order: 0,
    paddingStyle: true
  },
  adminOptions: {
    name: "adminOptions",
    order: 25,
    label: "Admin Options",
    startCollapsed: true,
  },
  event: {
    name: "event details",
    order: 21,
    label: "Event Details"
  },
  moderationGroup: {
    order: 60,
    name: "moderation",
    label: "Moderation Guidelines",
    helpText: "We prefill these moderation guidelines based on your user settings. But you can adjust them for each post.",
    startCollapsed: true,
  },
  options: {
    order:10,
    name: "options",
    defaultStyle: true,
    paddingStyle: true,
    flexStyle: true
  },
  content: { //TODO – should this be 'contents'? is it needed?
    order:20,
    name: "Content",
    defaultStyle: true,
    paddingStyle: true,
  },
  canonicalSequence: {
    order:30,
    name: "canonicalSequence",
    label: "Canonical Sequence",
    startCollapsed: true,
  },
  advancedOptions: {
    order:40,
    name: "advancedOptions",
    label: "Options",
    startCollapsed: true,
  },
  highlight: {
    order: 21,
    name: "highlight",
    label: "Highlight"
  }
};


const userHasModerationGuidelines = (currentUser: DbUser|null): boolean => {
  return !!(currentUser && ((currentUser.moderationGuidelines && currentUser.moderationGuidelines.html) || currentUser.moderationStyle))
}

addFieldsDict(Posts, {
  // URL (Overwriting original schema)
  url: {
    order: 12,
    control: 'EditUrl',
    placeholder: 'Add a linkpost URL',
    group: formGroups.options,
    editableBy: [userOwns, 'sunshineRegiment', 'admins']
  },
  // Title (Overwriting original schema)
  title: {
    order: 10,
    placeholder: "Title",
    control: 'EditTitle',
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    group: formGroups.default,
  },

  // Legacy: Boolean used to indicate that post was imported from old LW database
  legacy: {
    type: Boolean,
    optional: true,
    hidden: false,
    defaultValue: false,
    viewableBy: ['guests'],
    editableBy: ['admin'],
    insertableBy: ['admin'],
    control: "checkbox",
    order: 12,
    group: formGroups.adminOptions,
  },

  // Legacy ID: ID used in the original LessWrong database
  legacyId: {
    type: String,
    optional: true,
    hidden: true,
    viewableBy: ['guests'],
    editableBy: ['members'],
    insertableBy: ['members'],
  },

  // Legacy Spam: True if the original post in the legacy LW database had this post
  // marked as spam
  legacySpam: {
    type: Boolean,
    optional: true,
    defaultValue: false,
    hidden: true,
    viewableBy: ['guests'],
    editableBy: ['members'],
    insertableBy: ['members'],
  },

  // Feed Id: If this post was automatically generated by an integrated RSS feed
  // then this field will have the ID of the relevant feed
  feedId: {
    ...foreignKeyField({
      idFieldName: "feedId",
      resolverName: "feed",
      collectionName: "RSSFeeds",
      type: "RSSFeed",
      nullable: true,
    }),
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['admins'],
    insertableBy: ['admins'],
    group: formGroups.adminOptions,
  },

  // Feed Link: If this post was automatically generated by an integrated RSS feed
  // then this field will have the link to the original blogpost it was posted from
  feedLink: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['admins'],
    insertableBy: ['admins'],
    group: formGroups.adminOptions
  },
 

  // lastVisitedAt: If the user is logged in and has viewed this post, the date
  // they last viewed it. Otherwise, null.
  lastVisitedAt: resolverOnlyField({
    type: Date,
    viewableBy: ['guests'],
    resolver: async (post: DbPost, args: void, context: ResolverContext) => {
      const { ReadStatuses, currentUser } = context;
      if (!currentUser) return null;

      const readStatus = await getWithLoader(context, ReadStatuses,
        `readStatuses`,
        { userId: currentUser._id },
        'postId', post._id
      );
      if (!readStatus.length) return null;
      return readStatus[0].lastUpdated;
    }
  }),
  
  isRead: resolverOnlyField({
    type: Boolean,
    viewableBy: ['guests'],
    resolver: async (post: DbPost, args: void, context: ResolverContext) => {
      const { ReadStatuses, currentUser } = context;
      if (!currentUser) return false;
      
      const readStatus = await getWithLoader(context, ReadStatuses,
        `readStatuses`,
        { userId: currentUser._id },
        'postId', post._id
      );
      if (!readStatus.length) return false;
      return readStatus[0].isRead;
    }
  }),

  lastCommentedAt: {
    type: Date,
    denormalized: true,
    optional: true,
    hidden: true,
    viewableBy: ['guests'],
    onInsert: (post: DbPost) => post.postedAt || new Date(),
  },

  // curatedDate: Date at which the post was promoted to curated (null or false
  // if it never has been promoted to curated)
  curatedDate: {
    type: Date,
    control: 'datetime',
    optional: true,
    viewableBy: ['guests'],
    insertableBy: ['sunshineRegiment', 'admins'],
    editableBy: ['sunshineRegiment', 'admins'],
    group: formGroups.adminOptions,
  },
  // metaDate: Date at which the post was marked as meta (null or false if it
  // never has been marked as meta)
  metaDate: {
    type: Date,
    control: 'datetime',
    optional: true,
    viewableBy: ['guests'],
    insertableBy: ['sunshineRegiment', 'admins'],
    editableBy: ['sunshineRegiment', 'admins'],
    group: formGroups.adminOptions,
  },
  suggestForCuratedUserIds: {
    type: Array,
    viewableBy: ['members'],
    insertableBy: ['sunshineRegiment', 'admins'],
    editableBy: ['sunshineRegiment', 'admins'],
    optional: true,
    label: "Suggested for Curated by",
    control: "UsersListEditor",
    group: formGroups.adminOptions,
    resolveAs: {
      fieldName: 'suggestForCuratedUsernames',
      type: 'String',
      resolver: async (post: DbPost, args: void, context: ResolverContext): Promise<string|null> => {
        // TODO - Turn this into a proper resolve field.
        // Ran into weird issue trying to get this to be a proper "users"
        // resolve field. Wasn't sure it actually needed to be anyway,
        // did a hacky thing.
        const users = await Promise.all(_.map(post.suggestForCuratedUserIds,
          async userId => {
            const user = await context.loaders.Users.load(userId)
            return user.displayName;
          }
        ))
        if (users.length) {
          return users.join(", ")
        } else {
          return null
        }
      },
      addOriginalField: true,
    }
  },
  'suggestForCuratedUserIds.$': {
    type: String,
    foreignKey: 'Users',
    optional: true,
  },

  // frontpageDate: Date at which the post was promoted to frontpage (null or
  // false if it never has been promoted to frontpage)
  frontpageDate: {
    type: Date,
    control: 'datetime',
    viewableBy: ['guests'],
    editableBy: ['members'],
    insertableBy: ['members'],
    onInsert: frontpageDefault,
    optional: true,
    hidden: true,
  },

  collectionTitle: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['admins', 'sunshineRegiment'],
    insertableBy: ['admins', 'sunshineRegiment'],
    group: formGroups.canonicalSequence,
  },

  userId: {
    ...foreignKeyField({
      idFieldName: "userId",
      resolverName: "user",
      collectionName: "Users",
      type: "User",
      nullable: true,
    }),
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['admins'],
    insertableBy: ['admins'],
    hidden: false,
    control: "text",
    group: formGroups.adminOptions,
  },

  coauthorUserIds: {
    ...arrayOfForeignKeysField({
      idFieldName: "coauthorUserIds",
      resolverName: "coauthors",
      collectionName: "Users",
      type: "User"
    }),
    viewableBy: ['guests'],
    editableBy: ['sunshineRegiment', 'admins'],
    insertableBy: ['sunshineRegiment', 'admins'],
    optional: true,
    label: "Co-Authors",
    control: "UsersListEditor",
    group: formGroups.advancedOptions,
  },
  'coauthorUserIds.$': {
    type: String,
    foreignKey: 'Users',
    optional: true
  },
  
  // Cloudinary image id for an image that will be used as the OpenGraph image
  socialPreviewImageId: {
    type: String,
    optional: true,
    label: "Social Preview Image",
    viewableBy: ['guests'],
    editableBy: ['sunshineRegiment', 'admins'],
    insertableBy: ['sunshineRegiment', 'admins'],
    control: "ImageUpload",
    group: formGroups.advancedOptions,
  },
  
  // Autoset OpenGraph image, derived from the first post image in a callback
  socialPreviewImageAutoUrl: {
    type: String,
    optional: true,
    hidden: true,
    label: "Social Preview Image Auto-generated URL",
    viewableBy: ['guests'],
    editableBy: ['members'],
    insertableBy: ['members'],
  },

  canonicalSequenceId: {
    ...foreignKeyField({
      idFieldName: "canonicalSequenceId",
      resolverName: "canonicalSequence",
      collectionName: "Sequences",
      type: "Sequence",
      nullable: true,
    }),
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['admins', 'sunshineRegiment'],
    insertableBy: ['admins', 'sunshineRegiment'],
    group: formGroups.canonicalSequence,
    hidden: false,
    control: "text",
  },

  canonicalCollectionSlug: {
    type: String,
    foreignKey: {
      collection: 'Collections',
      field: 'slug'
    },
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['admins', 'sunshineRegiment'],
    insertableBy: ['admins', 'sunshineRegiment'],
    hidden: false,
    control: "text",
    group: formGroups.canonicalSequence,
    resolveAs: {
      fieldName: 'canonicalCollection',
      addOriginalField: true,
      type: "Collection",
      // TODO: Make sure we run proper access checks on this. Using slugs means it doesn't
      // work out of the box with the id-resolver generators
      resolver: async (post: DbPost, args: void, context: ResolverContext): Promise<DbCollection|null> => {
        if (!post.canonicalCollectionSlug) return null;
        return await context.Collections.findOne({slug: post.canonicalCollectionSlug})
      }
    },
  },

  canonicalBookId: {
    ...foreignKeyField({
      idFieldName: "canonicalBookId",
      resolverName: "canonicalBook",
      collectionName: "Books",
      type: "Book",
      nullable: true,
    }),
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['admins', 'sunshineRegiment'],
    insertableBy: ['admins', 'sunshineRegiment'],
    group: formGroups.canonicalSequence,
    hidden: false,
    control: "text",
  },

  canonicalNextPostSlug: {
    type: String,
    foreignKey: {
      collection: "Posts",
      field: 'slug',
    },
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['admins', 'sunshineRegiment'],
    insertableBy: ['admins', 'sunshineRegiment'],
    group: formGroups.canonicalSequence,
    hidden: false,
    control: "text"
  },

  canonicalPrevPostSlug: {
    type: String,
    foreignKey: {
      collection: "Posts",
      field: 'slug',
    },
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['admins', 'sunshineRegiment'],
    insertableBy: ['admins', 'sunshineRegiment'],
    group: formGroups.canonicalSequence,
    hidden: false,
    control: "text"
  },

  // The next post. If a sequenceId is provided, that sequence must contain this
  // post, and this returns the next post after this one in that sequence. If
  // no sequenceId is provided, uses this post's canonical sequence.
  nextPost: resolverOnlyField({
    type: "Post",
    graphQLtype: "Post",
    viewableBy: ['guests'],
    graphqlArguments: 'sequenceId: String',
    resolver: async (post: DbPost, args: {sequenceId: string}, context: ResolverContext) => {
      const { sequenceId } = args;
      const { currentUser, Posts } = context;
      if (sequenceId) {
        const nextPostID = await sequenceGetNextPostID(sequenceId, post._id);
        if (nextPostID) {
          const nextPost = await context.loaders.Posts.load(nextPostID);
          const nextPostFiltered = await accessFilterSingle(currentUser, Posts, nextPost, context);
          if (nextPostFiltered)
            return nextPostFiltered;
        }
      }
      if(post.canonicalSequenceId) {
        const nextPostID = await sequenceGetNextPostID(post.canonicalSequenceId, post._id);
        if (nextPostID) {
          const nextPost = await context.loaders.Posts.load(nextPostID);
          const nextPostFiltered = await accessFilterSingle(currentUser, Posts, nextPost, context);
          if (nextPostFiltered)
            return nextPostFiltered;
        }
      }
      if (post.canonicalNextPostSlug) {
        const nextPost = await Posts.findOne({ slug: post.canonicalNextPostSlug });
        const nextPostFiltered = await accessFilterSingle(currentUser, Posts, nextPost, context);
        if (nextPostFiltered)
          return nextPostFiltered;
      }

      return null;
    }
  }),

  // The previous post. If a sequenceId is provided, that sequence must contain
  // this post, and this returns the post before this one in that sequence.
  // If no sequenceId is provided, uses this post's canonical sequence.
  prevPost: resolverOnlyField({
    type: "Post",
    graphQLtype: "Post",
    viewableBy: ['guests'],
    graphqlArguments: 'sequenceId: String',
    resolver: async (post: DbPost, args: {sequenceId: string}, context: ResolverContext) => {
      const { sequenceId } = args;
      const { currentUser, Posts } = context;
      if (sequenceId) {
        const prevPostID = await sequenceGetPrevPostID(sequenceId, post._id);
        if (prevPostID) {
          const prevPost = await context.loaders.Posts.load(prevPostID);
          const prevPostFiltered = await accessFilterSingle(currentUser, Posts, prevPost, context);
          if (prevPostFiltered) {
            console.log(`prevPost = ${prevPostFiltered.slug}, from sequenceId`);
            return prevPostFiltered;
          }
        }
      }
      if(post.canonicalSequenceId) {
        const prevPostID = await sequenceGetPrevPostID(post.canonicalSequenceId, post._id);
        if (prevPostID) {
          const prevPost = await context.loaders.Posts.load(prevPostID);
          const prevPostFiltered = await accessFilterSingle(currentUser, Posts, prevPost, context);
          if (prevPostFiltered) {
            console.log(`prevPost = ${prevPostFiltered.slug}, from canonicalSequenceId`);
            return prevPostFiltered;
          }
        }
      }
      if (post.canonicalPrevPostSlug) {
        const prevPost = await Posts.findOne({ slug: post.canonicalPrevPostSlug });
        const prevPostFiltered = await accessFilterSingle(currentUser, Posts, prevPost, context);
        if (prevPostFiltered) {
          console.log(`prevPost = ${prevPostFiltered.slug}, from canonicalPrevPostSlug`);
          return prevPostFiltered;
        }
      }

      return null;
    }
  }),

  // A sequence this post is part of. Takes an optional sequenceId; if the
  // sequenceId is given and it contains this post, returns that sequence.
  // Otherwise, if this post has a canonical sequence, return that. If no
  // sequence ID is given and there is no canonical sequence for this post,
  // returns null.
  sequence: resolverOnlyField({
    type: "Sequence",
    graphQLtype: "Sequence",
    viewableBy: ['guests'],
    graphqlArguments: 'sequenceId: String',
    resolver: async (post: DbPost, args: {sequenceId: string}, context: ResolverContext) => {
      const { sequenceId } = args;
      const { currentUser } = context;
      let sequence: DbSequence|null = null;
      if (sequenceId && await sequenceContainsPost(sequenceId, post._id)) {
        sequence = await context.loaders.Sequences.load(sequenceId);
      } else if (post.canonicalSequenceId) {
        sequence = await context.loaders.Sequences.load(post.canonicalSequenceId);
      }

      return await accessFilterSingle(currentUser, context.Sequences, sequence, context);
    }
  }),

  // unlisted: If true, the post is not featured on the frontpage and is not
  // featured on the user page. Only accessible via it's ID
  unlisted: {
    type: Boolean,
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['admins', 'sunshineRegiment'],
    insertableBy: ['admins', 'sunshineRegiment'],
    label: "Make only accessible via link",
    control: "checkbox",
    order: 11,
    group: formGroups.adminOptions,
    ...schemaDefaultValue(false),
  },

  // disableRecommendation: If true, this post will never appear as a
  // recommended post (but will still appear in all other places, ie on its
  // author's profile, in archives, etc).
  // Use for things that lose their relevance with age, like announcements, or
  // for things that aged poorly, like results that didn't replicate.
  disableRecommendation: {
    type: Boolean,
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['admins', 'sunshineRegiment'],
    insertableBy: ['admins', 'sunshineRegiment'],
    label: "Exclude from Recommendations",
    control: "checkbox",
    order: 12,
    group: formGroups.adminOptions,
    ...schemaDefaultValue(false),
  },

  // defaultRecommendation: If true, always include this post in the recommendations
  defaultRecommendation: {
    type: Boolean,
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['admins', 'sunshineRegiment'],
    insertableBy: ['admins', 'sunshineRegiment'],
    label: "Include in default recommendations",
    control: "checkbox",
    order: 13,
    group: formGroups.adminOptions,
    ...schemaDefaultValue(false),
  },

  // Drafts
  draft: {
    label: 'Save to Drafts',
    type: Boolean,
    optional: true,
    ...schemaDefaultValue(false),
    viewableBy: ['members'],
    insertableBy: ['members'],
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    hidden: true,
  },


  // meta: The post is published to the meta section of the page
  meta: {
    type: Boolean,
    optional: true,
    viewableBy: ['guests'],
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    insertableBy: ['members'],
    hidden: true,
    label: "Publish to meta",
    control: "checkbox",
    ...schemaDefaultValue(false)
  },

  hideFrontpageComments: {
    type: Boolean,
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['admins'],
    insertableBy: ['admins'],
    control: 'checkbox',
    group: formGroups.moderationGroup,
    ...schemaDefaultValue(false),
  },

  // maxBaseScore: Highest baseScore this post ever had, used for RSS feed generation
  maxBaseScore: {
    type: Number,
    optional: true,
    viewableBy: ['guests'],
    hidden: true,
    onInsert: (document) => document.baseScore || 0,
  },
  // The timestamp when the post's maxBaseScore first exceeded 2
  scoreExceeded2Date: {
    type: Date,
    optional: true,
    viewableBy: ['guests'],
    onInsert: document => document.baseScore >= 2 ? new Date() : null
  },
  // The timestamp when the post's maxBaseScore first exceeded 30
  scoreExceeded30Date: {
    type: Date,
    optional: true,
    viewableBy: ['guests'],
    onInsert: document => document.baseScore >= 30 ? new Date() : null
  },
  // The timestamp when the post's maxBaseScore first exceeded 45
  scoreExceeded45Date: {
    type: Date,
    optional: true,
    viewableBy: ['guests'],
    onInsert: document => document.baseScore >= 45 ? new Date() : null
  },
  // The timestamp when the post's maxBaseScore first exceeded 75
  scoreExceeded75Date: {
    type: Date,
    optional: true,
    viewableBy: ['guests'],
    onInsert: document => document.baseScore >= 75 ? new Date() : null
  },
  bannedUserIds: {
    type: Array,
    viewableBy: ['guests'],
    group: formGroups.moderationGroup,
    insertableBy: [userCanModeratePost],
    editableBy: ['sunshines', 'admins'],
    hidden: true,
    optional: true,
    // label: "Users banned from commenting on this post",
    // control: "UsersListEditor",
  },
  'bannedUserIds.$': {
    type: String,
    foreignKey: "Users",
    optional: true
  },
  commentsLocked: {
    type: Boolean,
    viewableBy: ['guests'],
    group: formGroups.moderationGroup,
    insertableBy: (currentUser: DbUser|null, document: DbPost) => userCanCommentLock(currentUser, document),
    editableBy: (currentUser: DbUser|null, document: DbPost) => userCanCommentLock(currentUser, document),
    optional: true,
    control: "checkbox",
  },

  // Event specific fields:
  /////////////////////////////////////////////////////////////////////////////

  organizerIds: {
    ...arrayOfForeignKeysField({
      idFieldName: "organizerIds",
      resolverName: "organizers",
      collectionName: "Users",
      type: "User"
    }),
    viewableBy: ['guests'],
    insertableBy: ['members'],
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    optional: true,
    hidden: true,
    control: "UsersListEditor",
    group: formGroups.event,
  },

  'organizerIds.$': {
    type: String,
    foreignKey: "Users",
    optional: true,
  },

  groupId: {
    ...foreignKeyField({
      idFieldName: "groupId",
      resolverName: "group",
      collectionName: "Localgroups",
      type: "Localgroup",
      nullable: true,
    }),
    viewableBy: ['guests'],
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    insertableBy: ['members'],
    optional: true,
    hidden: true,
    group: formGroups.event,
  },

  isEvent: {
    type: Boolean,
    hidden: true,
    group: formGroups.event,
    viewableBy: ['guests'],
    editableBy: ['admins', 'sunshineRegiment'],
    insertableBy: ['members'],
    optional: true,
    ...schemaDefaultValue(false),
  },

  reviewedByUserId: {
    ...foreignKeyField({
      idFieldName: "reviewedByUserId",
      resolverName: "reviewedByUser",
      collectionName: "Users",
      type: "User",
      nullable: true,
    }),
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['sunshineRegiment', 'admins'],
    insertableBy: ['sunshineRegiment', 'admins'],
    hidden: true,
  },

  reviewForCuratedUserId: {
    type: String,
    foreignKey: "Users",
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['sunshineRegiment', 'admins'],
    insertableBy: ['sunshineRegiment', 'admins'],
    group: formGroups.adminOptions,
    label: "Curated Review UserId"
  },

  startTime: {
    type: Date,
    hidden: (props) => !props.eventForm,
    viewableBy: ['guests'],
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    insertableBy: ['members'],
    control: 'datetime',
    label: "Start Time",
    group: formGroups.event,
    optional: true,
  },

  localStartTime: {
    type: Date,
    viewableBy: ['guests'],
  },

  endTime: {
    type: Date,
    hidden: (props) => !props.eventForm,
    viewableBy: ['guests'],
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    insertableBy: ['members'],
    control: 'datetime',
    label: "End Time",
    group: formGroups.event,
    optional: true,
  },

  localEndTime: {
    type: Date,
    viewableBy: ['guests'],
  },

  onlineEvent: {
    type: Boolean,
    hidden: (props) => !props.eventForm,
    viewableBy: ['guests'],
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    insertableBy: ['members'],
    optional: true,
    group: formGroups.event,
    order: 0,
    ...schemaDefaultValue(false),
  },

  mongoLocation: {
    type: Object,
    viewableBy: ['guests'],
    hidden: true,
    blackbox: true,
    optional: true,
    ...denormalizedField({
      needsUpdate: data => ('googleLocation' in data),
      getValue: async (post) => {
        if (post.googleLocation) return googleLocationToMongoLocation(post.googleLocation)
      }
    }),
  },

  googleLocation: {
    type: Object,
    hidden: (props) => !props.eventForm,
    viewableBy: ['guests'],
    insertableBy: ['members'],
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    label: "Group Location",
    control: 'LocationFormComponent',
    blackbox: true,
    group: formGroups.event,
    optional: true
  },

  location: {
    type: String,
    viewableBy: ['guests'],
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    insertableBy: ['members'],
    hidden: true,
    optional: true
  },

  contactInfo: {
    type: String,
    hidden: (props) => !props.eventForm,
    viewableBy: ['guests'],
    insertableBy: ['members'],
    editableBy: ['members'],
    label: "Contact Info",
    control: "MuiInput",
    optional: true,
    group: formGroups.event,
  },

  facebookLink: {
    type: String,
    hidden: (props) => !props.eventForm,
    viewableBy: ['guests'],
    insertableBy: ['members'],
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    label: "Facebook Event",
    control: "MuiInput",
    optional: true,
    group: formGroups.event,
  },

  website: {
    type: String,
    hidden: (props) => !props.eventForm,
    viewableBy: ['guests'],
    insertableBy: ['members'],
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    control: "MuiInput",
    optional: true,
    group: formGroups.event,
  },

  types: {
    type: Array,
    viewableBy: ['guests'],
    insertableBy: ['members'],
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    hidden: (props) => !props.eventForm,
    control: 'MultiSelectButtons',
    label: "Group Type:",
    group: formGroups.event,
    optional: true,
    form: {
      options: localGroupTypeFormOptions
    },
  },

  'types.$': {
    type: String,
    optional: true,
  },

  metaSticky: {
    order:10,
    type: Boolean,
    optional: true,
    label: "Sticky (Meta)",
    ...schemaDefaultValue(false),
    group: formGroups.adminOptions,
    viewableBy: ['guests'],
    editableBy: ['admins'],
    insertableBy: ['admins'],
    control: 'checkbox',
    onInsert: (post) => {
      if(!post.metaSticky) {
        return false;
      }
    },
    onEdit: (modifier, post) => {
      if (!modifier.$set.metaSticky) {
        return false;
      }
    }
  },

  sticky: {
    order:10,
    group: formGroups.adminOptions
  },

  postedAt: {
    group: formGroups.adminOptions
  },

  status: {
    group: formGroups.adminOptions,
  },

  shareWithUsers: {
    type: Array,
    order: 15,
    viewableBy: ['guests'],
    insertableBy: ['members'],
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    optional: true,
    control: "UsersListEditor",
    label: "Share draft with users",
    group: formGroups.options
  },

  'shareWithUsers.$': {
    type: String,
    foreignKey: "Users",
    optional: true
  },

  commentSortOrder: {
    type: String,
    viewableBy: ['guests'],
    insertableBy: ['admins'],
    editableBy: ['admins'],
    optional: true,
    group: formGroups.adminOptions,
  },

  // hideAuthor: Post stays online, but doesn't show on your user profile anymore, and doesn't
  // link back to your account
  hideAuthor: {
    type: Boolean,
    viewableBy: ['guests'],
    insertableBy: ['admins'],
    editableBy: ['admins'],
    optional: true,
    group: formGroups.adminOptions,
    ...schemaDefaultValue(false),
  },

  tableOfContents: resolverOnlyField({
    type: Object,
    viewableBy: ['guests'],
    graphQLtype: GraphQLJSON,
    resolver: async (document: DbPost, args: void, context: ResolverContext) => {
      const { currentUser } = context;
      try {
        return await Utils.getTableOfContentsData({document, version: null, currentUser, context});
      } catch(e) {
        captureException(e);
        return null;
      }
    },
  }),

  tableOfContentsRevision: resolverOnlyField({
    type: Object,
    viewableBy: ['guests'],
    graphQLtype: GraphQLJSON,
    graphqlArguments: 'version: String',
    resolver: async (document: DbPost, args: {version:string}, context: ResolverContext) => {
      const { version=null } = args;
      const { currentUser } = context;
      try {
        return await Utils.getTableOfContentsData({document, version, currentUser, context});
      } catch(e) {
        captureException(e);
        return null;
      }
    },
  }),

  // GraphQL only field that resolves based on whether the current user has closed
  // this posts author's moderation guidelines in the past
  showModerationGuidelines: {
    type: Boolean,
    optional: true,
    canRead: ['guests'],
    resolveAs: {
      type: 'Boolean',
      resolver: async (post: DbPost, args: void, context: ResolverContext): Promise<boolean> => {
        const { LWEvents, currentUser } = context;
        if(currentUser){
          const query = {
            name:'toggled-user-moderation-guidelines',
            documentId: post.userId,
            userId: currentUser._id
          }
          const sort = {sort:{createdAt:-1}}
          const event = await LWEvents.findOne(query, sort);
          const author = await context.Users.findOne({_id: post.userId});
          if (event) {
            return !!(event.properties && event.properties.targetState)
          } else {
            return !!(author?.collapseModerationGuidelines ? false : ((post.moderationGuidelines && post.moderationGuidelines.html) || post.moderationStyle))
          }
        } else {
          return false
        }
      },
      addOriginalField: false
    }
  },

  moderationStyle: {
    type: String,
    optional: true,
    control: "select",
    group: formGroups.moderationGroup,
    label: "Style",
    viewableBy: ['guests'],
    editableBy: [userOwns, 'sunshineRegiment', 'admins'],
    insertableBy: [userOwns, 'sunshineRegiment', 'admins'],
    blackbox: true,
    order: 55,
    form: {
      options: function () { // options for the select form control
        return [
          {value: "", label: "No Moderation"},
          {value: "easy-going", label: "Easy Going - I just delete obvious spam and trolling."},
          {value: "norm-enforcing", label: "Norm Enforcing - I try to enforce particular rules (see below)"},
          {value: "reign-of-terror", label: "Reign of Terror - I delete anything I judge to be annoying or counterproductive"},
        ];
      }
    },
  },
  
  // On a post, do not show comment karma
  hideCommentKarma: {
    type: Boolean,
    optional: true,
    group: formGroups.moderationGroup,
    viewableBy: ['guests'],
    insertableBy: ['admins', postCanEditHideCommentKarma],
    editableBy: ['admins', postCanEditHideCommentKarma],
    hidden: forumTypeSetting.get() !== 'EAForum',
    denormalized: true,
    ...schemaDefaultValue(false),
  },

  commentCount: {
    type: Number,
    optional: true,
    defaultValue: 0,
    
    ...denormalizedCountOfReferences({
      fieldName: "commentCount",
      collectionName: "Posts",
      foreignCollectionName: "Comments",
      foreignTypeName: "comment",
      foreignFieldName: "postId",
      filterFn: comment => !comment.deleted
    }),
    canRead: ['guests'],
  },
  
  recentComments: resolverOnlyField({
    type: Array,
    graphQLtype: "[Comment]",
    viewableBy: ['guests'],
    graphqlArguments: 'commentsLimit: Int, maxAgeHours: Int, af: Boolean',
    resolver: async (post: DbPost, args: {commentsLimit?: number, maxAgeHours?: number, af?: boolean}, context: ResolverContext) => {
      const { commentsLimit=5, maxAgeHours=18, af=false } = args;
      const { currentUser, Comments } = context;
      const timeCutoff = moment(post.lastCommentedAt).subtract(maxAgeHours, 'hours').toDate();
      const comments = await Comments.find({
        ...Comments.defaultView({}).selector,
        postId: post._id,
        score: {$gt:0},
        deletedPublic: false,
        postedAt: {$gt: timeCutoff},
        ...(af ? {af:true} : {}),
      }, {
        limit: commentsLimit,
        sort: {postedAt:-1}
      }).fetch();
      return await accessFilterMultiple(currentUser, Comments, comments, context);
    }
  }),
  'recentComments.$': {
    type: Object,
    foreignKey: 'Comments',
  },
});

makeEditable({
  collection: Posts,
  options: {
    formGroup: formGroups.content,
    order: 25,
    pingbacks: true,
  }
})

makeEditable({
  collection: Posts,
  options: {
    // Determines whether to use the comment editor configuration (e.g. Toolbars)
    commentEditor: true,
    // Determines whether to use the comment editor styles (e.g. Fonts)
    commentStyles: true,
    formGroup: formGroups.moderationGroup,
    order: 50,
    fieldName: "moderationGuidelines",
    permissions: {
      viewableBy: ['guests'],
      editableBy: [userOwns, 'sunshineRegiment', 'admins'],
      insertableBy: [userHasModerationGuidelines]
    },
  }
})

makeEditable({
  collection: Posts,
  options: {
    formGroup: formGroups.highlight,
    fieldName: "customHighlight",
    permissions: {
      viewableBy: ['guests'],
      editableBy: ['sunshineRegiment', 'admins'],
      insertableBy: ['sunshineRegiment', 'admins'],
    },
  }
})
