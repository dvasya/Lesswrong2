import { registerComponent } from '../../lib/vulcan-lib';
import React from 'react';

import { secondaryInfo } from '../tagging/TagProgressBar';
import { gatherIcon } from '../icons/gatherIcon';
import { LWEvents } from '../../lib/collections/lwevents';
import { useMulti } from '../../lib/crud/withMulti';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import { useUpdate } from '../../lib/crud/withUpdate';
import Users from '../../lib/vulcan-users';
import { useCurrentUser } from '../common/withUser';
import { useMessages } from '../common/withMessages';
import CloseIcon from '@material-ui/icons/Close';
import classNames from 'classnames'

const styles = (theme: ThemeType): JssStyles => ({
  root: {
    marginTop: 20,
    ...theme.typography.body2,
    ...theme.typography.commentStyle,
    display: "flex",
    '& a': {
      color: theme.palette.primary.main
    },
    alignItems: "center",
    position: 'relative',
    '&:hover $hide': {
      opacity: 1
    },
    marginBottom: 8
  },
  secondaryInfo: {
    ...secondaryInfo(theme),
    marginTop: 0,
    display: "flex",
    justifyContent: "space-between",
  },
  usersOnlineList: {
    ...secondaryInfo(theme),
    justifyContent: 'flex-start',
    marginTop: 0
  },
  noUsers: {
    fontSize: '0.8rem',
    color: 'rgba(0,0,0,0.5)'
  },
  icon: {
    marginRight: 24,
    marginLeft: 6,
  },
  hide: {
    position: 'absolute',
    top: 8,
    right: 8,
    cursor: "pointer",
    width: '0.5em',
    height: '0.5em',
    color: 'rgba(0,0,0,0.5)',
    opacity: 0
  },
  onlineDot: {
    color: theme.palette.primary.main,
    width: '0.5em',
    height: '0.5em',
    position: 'relative',
    top: 2,
    display: 'inline-block',
    marginRight: '-2px'
  },
  redDot: {
    color: theme.palette.error.main,
    marginRight: 4,
    top: '3.5px'
  },
  userNames: {
    marginLeft: 5,
  },
  userName: {
    marginLeft: 5
  }
})

const GatherTown = ({classes}: {
  classes: ClassesType,
}) => {
  const { results } = useMulti({
    terms: {
      view: "gatherTownUsers",
      limit: 1,
    },
    collection: LWEvents,
    fragmentName: 'lastEventFragment',
    enableTotal: false,
  });
  const users = results && results[0]?.properties?.gatherTownUsers
  const userList = users && Object.keys(users)
  const currentUser = useCurrentUser()
  const { flash } = useMessages();

  const { mutate: updateUser } = useUpdate({
    collection: Users,
    fragmentName: 'UsersCurrent',
  });


  if (!currentUser) return null
  if (currentUser.hideWalledGardenUI) return null

  const hideClickHandler = async () => {
    await updateUser({
      selector: { _id: currentUser._id },
      data: {
        hideWalledGardenUI: true
      },
    })
    flash({
      messageString: "Hid Walled Garden from frontpage",
      type: "success",
      action: () => void updateUser({
        selector: { _id: currentUser._id },
        data: {
          hideWalledGardenUI: false
        },
      })
    })
  }
  return (
    <div className={classes.root}>
      <CloseIcon className={classes.hide} onClick={hideClickHandler} />
      <div className={classes.icon}>{gatherIcon} </div>
      <div>
        <div>You're invited to the <a href="https://gather.town/app/aPVfK3G76UukgiHx/lesswrong-campus">Walled Garden Beta</a></div>
        <div className={classes.secondaryInfo}>
          <div>A private, permanent virtual world. Coworking 2pm-7pm PT weekdays. Schelling Social hours at 1pm and 7pm.</div>
        </div>
        {userList && userList.length > 0 && <div className={classes.usersOnlineList}>
            Online: <span className={classes.userNames}>
            {Object.keys(users).map(user => <span className={classes.userName} key={user}><FiberManualRecordIcon className={classes.onlineDot}/> {user}</span>)}
          </span>
        </div>}
        {userList && !userList.length && <div className={classNames(classes.usersOnlineList, classes.noUsers)}> 
          <FiberManualRecordIcon className={classNames(classes.onlineDot, classes.redDot)}/> No users currently online. Check back later or be the first to join!
        </div>}
      </div>
    </div>
  )
}

const GatherTownComponent = registerComponent('GatherTown', GatherTown, {styles});

declare global {
  interface ComponentTypes {
    GatherTown: typeof GatherTownComponent
  }
}
