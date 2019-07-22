import { registerComponent, Components } from 'meteor/vulcan:core';
import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import { queryIsUpdating } from './queryStatusUtils'

const styles = theme => {
  return {
    root: {
      ...theme.typography.body2,
      ...theme.typography.commentStyle,
      color: theme.palette.lwTertiary.main,
    },
    disabled: {
      color: theme.palette.grey[400],
      cursor: 'default',
      '&:hover': {
        opacity: 1
      }
    }
  }
}


// TODO; accept loading status param, use utility function to check for loading
// status
const LoadMore = ({ loadMore, count, totalCount, classes, disabled=false, networkStatus }) => {
  const { Loading } = Components
  const handleClickLoadMore = event => {
    event.preventDefault();
    loadMore();
  }

  if (networkStatus && queryIsUpdating(networkStatus)) {
    return <div className={classes.loading}>
      <Loading/>
    </div>
  }

  return (
    <a
      className={classNames(
        classes.root,
        {[classes.disabled]: disabled},
      )}
      href="#"
      onClick={handleClickLoadMore}
    >
      Load More {totalCount && <span> ({count}/{totalCount})</span>}
    </a>
  )
}

LoadMore.displayName = "LoadMore";

registerComponent('LoadMore', LoadMore,
  withStyles(styles, { name: "LoadMore" })
);
