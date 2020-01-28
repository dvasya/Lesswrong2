import { Components, registerComponent } from 'meteor/vulcan:core';
import { useSingle } from '../../lib/crud/withSingle';
import { Posts } from '../../lib/collections/posts';
import React, { useState, useEffect, useRef } from 'react';
import { createStyles } from '@material-ui/core/styles';
import withUser from '../common/withUser';
import { useLocation } from '../../lib/routeUtil';
import { editorStyles, postBodyStyles } from '../../themes/stylePiping'

const styles = createStyles(theme => ({
  title: {
    ...theme.typography.display3,
    ...theme.typography.postStyle,
    ...theme.typography.headerStyle,
    marginBottom: "1em",
  },
  editor: {
    ...editorStyles(theme, postBodyStyles),
    cursor: "text",
    maxWidth: 640,
    position: "relative",
    padding: 0,
    '& li .public-DraftStyleDefault-block': {
      margin: 0
    }
  }
}))

// Editor that _only_ gives people access to the ckEditor, without any other post options
const PostCollaborationEditor = ({ classes, currentUser}) => {
  const { SingleColumnSection, Loading } = Components
  const editorRef = useRef<any>(null)
  const [editorLoaded, setEditorLoaded] = useState(false)
  useEffect(() => {
    const importEditor = async () => {
      let EditorModule = await import('../async/CKPostEditor')
      const Editor = EditorModule.default
      editorRef.current = Editor
      setEditorLoaded(true)
    }
    importEditor()
  }, [])

  const { query: { postId } } = useLocation();

  const { document: post } = useSingle({
    collection: Posts,
    fragmentName: 'PostsPage',
    fetchPolicy: 'cache-then-network' as any, //TODO
    documentId: postId,
  });
  const Editor = editorRef.current
  return <SingleColumnSection>
      <div className={classes.title}>{post?.title}</div>
      <div className={classes.editor}>
        {editorLoaded ? <Editor 
          documentId={postId}
          formType="edit"
          userId={currentUser?._id}
          collaboration
        /> : <Loading />}
      </div>
  </SingleColumnSection>
};

const PostCollaborationEditorComponent = registerComponent('PostCollaborationEditor', PostCollaborationEditor, {
  styles,
  hocs: [withUser],
});

declare global {
  interface ComponentTypes {
    PostCollaborationEditor: typeof PostCollaborationEditorComponent
  }
}
