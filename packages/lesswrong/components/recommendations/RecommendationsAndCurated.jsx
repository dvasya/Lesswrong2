import React, { PureComponent } from 'react';
import { Components, registerComponent } from 'meteor/vulcan:core';
import { withUpdate } from '../../lib/crud/withUpdate';
import { withStyles } from '@material-ui/core/styles';
import withUser from '../common/withUser';
import Users from 'meteor/vulcan:users';
import { Link } from '../../lib/reactRouterWrapper';
import Tooltip from '@material-ui/core/Tooltip';
import classNames from 'classnames';
import { getRecommendationSettings } from './RecommendationsAlgorithmPicker'
import { withContinueReading } from './withContinueReading';
import Typography from '@material-ui/core/Typography';
import Hidden from '@material-ui/core/Hidden';
import {AnalyticsContext} from "../../lib/analyticsEvents";

const styles = theme => ({
  section: {
    marginTop: -12,
  },
  continueReadingList: {
    marginBottom: theme.spacing.unit*2,
  },
  subsection: {
    marginBottom: theme.spacing.unit*2,
  },
  footerWrapper: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  footer: {
    color: theme.palette.lwTertiary.main,
    flexGrow: 1,
    maxWidth: 450,
    
    display: "flex",
    justifyContent: "space-around",
  }
});

const defaultFrontpageSettings = {
  method: "sample",
  count: 3,
  scoreOffset: 0,
  scoreExponent: 3,
  personalBlogpostModifier: 0,
  frontpageModifier: 10,
  curatedModifier: 50,
}


class RecommendationsAndCurated extends PureComponent {
  state = { showSettings: false, stateSettings: null }

  toggleSettings = () => {
    this.setState(prevState => ({showSettings: !prevState.showSettings}))
  }

  changeSettings = (newSettings) => {
    this.setState({
      settings: newSettings
    });
  }

  render() {
    const { continueReading, classes, currentUser } = this.props;
    const { showSettings } = this.state
    const { RecommendationsAlgorithmPicker, SingleColumnSection, SettingsIcon, ContinueReadingList, PostsList2, SubscribeWidget, SectionTitle, SectionSubtitle, SeparatorBullet, BookmarksList, RecommendationsList } = Components;

    const configName = "frontpage"
    const settings = getRecommendationSettings({settings: this.state.settings, currentUser, configName})

    const curatedTooltip = <div>
      <div>Every few days, LessWrong moderators manually curate posts that are well written and informative.</div>
      <div><em>(Click to see more curated posts)</em></div>
    </div>

    const coreReadingTooltip = <div>
      <div>Collections of posts that form the core background knowledge of the LessWrong community</div>
    </div>

    const continueReadingTooltip = <div>
      <div>The next posts in sequences you've started reading, but not finished.</div>
    </div>

    const bookmarksTooltip = <div>
      <div>Individual posts that you've bookmarked</div>
      <div><em>(Click to see all)</em></div>
    </div>

    // Disabled during 2018 Review
    const allTimeTooltip = <div>
      <div>
        A weighted, randomized sample of the highest karma posts
        {settings.onlyUnread && " that you haven't read yet"}.
      </div>
      <div><em>(Click to see more recommendations)</em></div>
    </div>

    // defaultFrontpageSettings does not contain anything that overrides a user
    // editable setting, so the reverse ordering here is fine
    const frontpageRecommendationSettings = {
      ...settings,
      ...defaultFrontpageSettings
    }

    const renderBookmarks = (currentUser?.bookmarkedPostsMetadata?.length > 0) && !settings.hideBookmarks
    const renderContinueReading = (continueReading?.length > 0) && !settings.hideContinueReading
    const curatedUrl = "/allPosts?filter=curated&sortedBy=new&timeframe=allTime"

    return <SingleColumnSection className={classes.section}>
      <SectionTitle title="Recommendations">
        <Tooltip title="Customize your recommendations">
          <SettingsIcon onClick={this.toggleSettings} label="Settings"/> 
        </Tooltip>
      </SectionTitle>
      {showSettings &&
        <RecommendationsAlgorithmPicker
          configName={configName}
          settings={frontpageRecommendationSettings}
          onChange={(newSettings) => this.changeSettings(newSettings)}
        /> }

      {renderContinueReading && <div className={classes.subsection}>
          <Tooltip placement="top-start" title={currentUser ? continueReadingTooltip : coreReadingTooltip}>
            <Link to={"/library"}>
              <SectionSubtitle className={classNames(classes.subtitle, classes.continueReading)}>
                {currentUser ? "Continue Reading" : "Core Reading" }
              </SectionSubtitle>
            </Link>
          </Tooltip>
          <ContinueReadingList continueReading={continueReading} />
        </div>}

      {renderBookmarks && <div className={classes.subsection}>
        <Tooltip placement="top-start" title={bookmarksTooltip}>
          <Link to={"/bookmarks"}>
            <SectionSubtitle>
              Bookmarks
            </SectionSubtitle>
          </Link>
        </Tooltip>
        <AnalyticsContext listContext={"frontpageBookmarksList"} capturePostItemOnMount>
          <BookmarksList limit={3} />
        </AnalyticsContext>
      </div>}

      {/* disabled except during review */}
      {/* <AnalyticsContext pageSectionContext="LessWrong 2018 Review">
        <FrontpageVotingPhase settings={frontpageRecommendationSettings} />
      </AnalyticsContext> */}

      {/* Disabled during 2018 Review */}
      {!settings.hideFrontpage && <div className={classes.subsection}>
        <Tooltip placement="top-start" title={allTimeTooltip}>
          <Link to={"/recommendations"}>
            <SectionSubtitle className={classNames(classes.subtitle, classes.fromTheArchives)} >
              From the Archives
            </SectionSubtitle>
          </Link>
        </Tooltip>
        <AnalyticsContext listContext={"frontpageFromTheArchives"} capturePostItemOnMount>
          <RecommendationsList algorithm={frontpageRecommendationSettings} />
        </AnalyticsContext>
      </div>}

      <AnalyticsContext pageSectionContext={"curatedPosts"}>
        <div className={classes.subsection}>
          <Tooltip placement="top-start" title={curatedTooltip}>
            <Link to={curatedUrl}>
              <SectionSubtitle className={classes.subtitle}>
                Recently Curated
              </SectionSubtitle>
            </Link>
          </Tooltip>
          <AnalyticsContext listContext={"curatedPosts"}>
            <PostsList2 terms={{view:"curated", limit:3}} showLoadMore={false} hideLastUnread={true}/>
          </AnalyticsContext>
          <div className={classes.footerWrapper}>
            <Typography component="div" variant="body2" className={classes.footer}>
              <Link to={curatedUrl}>
                { /* On very small screens, use shorter link text ("More Curated"
                    instead of "View All Curated Posts") to avoid wrapping */ }
                <Hidden smUp implementation="css">More Curated</Hidden>
                <Hidden xsDown implementation="css">View All Curated Posts</Hidden>
              </Link>
              <SeparatorBullet/>
              <SubscribeWidget view={"curated"} />
            </Typography>
          </div>
        </div>
      </AnalyticsContext>
    </SingleColumnSection>
  }
}

registerComponent("RecommendationsAndCurated", RecommendationsAndCurated,
  [withUpdate, {
    collection: Users,
    fragmentName: "UsersCurrent",
  }],
  withContinueReading,
  withUser, withStyles(styles, {name: "RecommendationsAndCurated"}));