import { registerComponent } from 'meteor/vulcan:core';
import { useUpdate } from '../../lib/crud/withUpdate';
import React, { useState } from 'react';
import MenuItem from '@material-ui/core/MenuItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import Bookmark from '@material-ui/icons/Bookmark'
import BookmarkBorder from '@material-ui/icons/BookmarkBorder'
import { useCurrentUser } from '../common/withUser';
import { useDialog } from '../common/withDialog';
import withErrorBoundary from '../common/withErrorBoundary';
import Users from 'meteor/vulcan:users';
import Tooltip, {TooltipProps} from '@material-ui/core/Tooltip';
import { createStyles } from '@material-ui/core/styles'
import { useTracking } from '../../lib/analyticsEvents';
import * as _ from 'underscore';

const styles = createStyles(theme => ({
  icon: {
    cursor: "pointer",
    color: theme.palette.grey[500]
  }
}))

const BookmarkButton = ({classes, post, menuItem, placement="right"}: {
  classes: any,
  post: any,
  menuItem?: boolean,
  placement?: TooltipProps["placement"],
}) => {
  const currentUser = useCurrentUser();
  const { openDialog } = useDialog();
  const [bookmarked, setBookmarked] = useState(_.pluck((currentUser?.bookmarkedPostsMetadata || []), 'postId')?.includes(post._id))
  const { captureEvent } = useTracking({eventType: "bookmarkToggle", eventProps: {"postId": post._id, "bookmarked": !bookmarked}})

  const {mutate: updateUser} = useUpdate({
    collection: Users,
    fragmentName: 'UserBookmarks',
  });


  const toggleBookmark = (event) => {
    if (!currentUser) {
      openDialog({
        componentName: "LoginPopup",
        componentProps: {}
      });
      event.preventDefault();
      return
    }

    if (bookmarked) {
      setBookmarked(false)
      const bookmarks = currentUser.bookmarkedPostsMetadata || []
      const newBookmarks = _.without(bookmarks, _.findWhere(bookmarks, {postId: post._id}))

      updateUser({
        selector: {_id: currentUser._id},
        data: { bookmarkedPostsMetadata: newBookmarks }
      });
    } else {
      setBookmarked(true)
      const bookmarks = currentUser.bookmarkedPostsMetadata || []
      updateUser({
        selector: {_id: currentUser._id},
        data: { bookmarkedPostsMetadata: [...bookmarks, {postId: post._id}] }
      });
    }
    captureEvent()
  }

  const icon = bookmarked ? <Bookmark/> : <BookmarkBorder/>
  const title = bookmarked ? "Un-bookmark" : "Bookmark"

  if (menuItem) {
    return (
      <MenuItem onClick={toggleBookmark}>
        <ListItemIcon>
          { icon }
        </ListItemIcon>
        {title}
      </MenuItem>
    )
  } else {
    return (
      <Tooltip title={title} placement={placement}>
        <span onClick={toggleBookmark} className={classes.icon}>
        { icon }
        </span>
      </Tooltip>
    )
  }
}

const BookmarkButtonComponent = registerComponent('BookmarkButton', BookmarkButton, {
  styles,
  hocs: [withErrorBoundary],
});

declare global {
  interface ComponentTypes {
    BookmarkButton: typeof BookmarkButtonComponent
  }
}