import useSaga from '@little-saga/use-saga'
import classNames from 'classnames'
import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import temme from 'temme'
import { useDialogs } from '../dialogs'
import { FileIcon } from '../icons'
import toaster from '../toaster'
import { useBodyOverflowHidden, useDidMount, useWillUnmount } from '../utils/common'
import debounce from '../utils/debounce'
import { useSession } from '../utils/session'
import * as actions from './actions'
import './configureTemmeLanguage'
import EditorWrapper from './EditorWrapper'
import { FileTypeHtmlIcon, FileTypeJsonIcon, FileTypeTSIcon } from './icons'
import { State } from './interfaces'
import PageLayout from './PageLayout'
import './ProjectPage.styl'
import saga from './saga'
import Sidebar from './Sidebar'
import { CodeEditor, CTRL_S, disposeAllEditorModels, INIT_EDITOR_OPTIONS } from './utils'

export interface ProjectPageProps {
  login: string
  projectName: string
}

export default function ProjectPage({ login, projectName }: ProjectPageProps) {
  const dialogs = useDialogs()

  const htmlEditorRef = useRef<CodeEditor>(null)
  const selectorEditorRef = useRef<CodeEditor>(null)
  const outputEditorRef = useRef<CodeEditor>(null)

  const customEnv = { htmlEditorRef, selectorEditorRef, outputEditorRef, dialogs }
  const [state, dispatch] = useSaga<State, actions.Action>({
    customEnv,
    saga,
    args: [login, projectName],
    initialState: new State(),
  })

  const { project, pages, activePageId } = state
  const activePage = pages.get(activePageId)
  const session = useSession()
  const readonly = session.username !== login

  function wrap<ARGS extends any[]>(actionCreator: (...args: ARGS) => actions.Action) {
    return (...args: ARGS) => dispatch(actionCreator(...args))
  }

  // 将 body.style.overflow 设置为 hidden
  // 防止 monaco 编辑器中部分元素导致的额外滚动条
  useBodyOverflowHidden()

  // 监听 htmlEditor 和 selectorEditor 中的变化，自动重新计算 output
  useEffect(() => {
    const htmlEditor = htmlEditorRef.current
    const selectorEditor = selectorEditorRef.current
    const outputEditor = outputEditorRef.current

    function compute() {
      try {
        const html = htmlEditor.getValue()
        const selector = selectorEditor.getValue()

        // TODO should use try-catch to catch parse/execution exceptions
        const result = temme(html, selector)
        const oldValue = outputEditor.getValue()
        const newValue = JSON.stringify(result, null, 2)
        if (oldValue !== newValue) {
          outputEditor.setValue(newValue)
        }
      } catch (e) {
        console.error(e)
      }
    }

    // 首次计算结果
    compute()
    // 每当 html 或 选择器的内容发生变化时，重新计算结果
    const debouncedCompute = debounce(compute, 300)
    const disposable1 = htmlEditor.onDidChangeModelContent(debouncedCompute)
    const disposable2 = selectorEditor.onDidChangeModelContent(debouncedCompute)

    return () => {
      debouncedCompute.dispose()
      disposable1.dispose()
      disposable2.dispose()
    }
  }, [activePageId])

  // 监听 htmlEditor 中的变化，自动更新 activePage.htmlAvid
  useEffect(() => {
    const model = htmlEditorRef.current.getModel()
    if (model == null) {
      return
    }
    const disposable = model.onDidChangeContent(() => {
      const avid = model.getAlternativeVersionId()
      dispatch(actions.updateActiveHtmlAvid(avid))
    })
    return () => disposable.dispose()
  }, [activePageId])

  // 监听 selectorEditor 中的变化，自动更新 activePageId.selectorAvid
  useEffect(() => {
    const model = selectorEditorRef.current.getModel()
    if (model == null) {
      return
    }
    const disposable = model.onDidChangeContent(() => {
      const avid = model.getAlternativeVersionId()
      dispatch(actions.updateActiveSelectorAvid(avid))
    })
    return () => disposable.dispose()
  }, [activePageId])

  // 给编辑器绑定 ctrl+S 快捷键
  useDidMount(() => {
    const warnReadonly = () =>
      toaster.show({
        icon: 'info-sign',
        intent: 'primary',
        message: '无法保存对只读项目的修改。',
        action: {
          onClick: wrap(actions.requestImportProject),
          text: '导入该项目',
        },
      })
    const handler = readonly ? warnReadonly : wrap(actions.requestSaveCurrentPage)
    htmlEditorRef.current.addCommand(CTRL_S, handler, '')
    selectorEditorRef.current.addCommand(CTRL_S, handler, '')
    // monaco editor 不提供 removeCommand 方法，故这里不需要（也没办法）返回一个清理函数
  })

  // 在退出页面时，销毁所有的 model
  useWillUnmount(disposeAllEditorModels)

  /** 让各个编辑器重新根据父元素的大小进行布局 */
  function layout() {
    // 用户可能在各个编辑器尚未加载时 调整了浏览器窗口大小
    htmlEditorRef.current && htmlEditorRef.current.layout()
    selectorEditorRef.current && selectorEditorRef.current.layout()
    outputEditorRef.current && outputEditorRef.current.layout()
  }

  return (
    <div className="project-page">
      <nav>
        <h1>
          <Link to="/">T</Link>
        </h1>
        <Link style={{ color: 'white' }} to={`/@${login}`}>
          @{login}
        </Link>
        <span>&nbsp;/&nbsp;{projectName}</span>
      </nav>
      <PageLayout
        layout={layout}
        sidebar={<Sidebar state={state} dispatch={dispatch} readonly={readonly} />}
        left={
          <>
            {activePage != null && (
              <div className="tablist">
                <div className={classNames('tab active')}>
                  <FileTypeHtmlIcon />
                  <span className="tabname">{activePage.name}.html</span>
                </div>
              </div>
            )}
            <EditorWrapper editorRef={htmlEditorRef} options={INIT_EDITOR_OPTIONS.html} />
          </>
        }
        rightTop={
          <>
            {activePage != null && (
              <div className="tablist">
                <div className={classNames('tab active')}>
                  <FileIcon />
                  <span className="tabname">{activePage.name}.temme</span>
                </div>
              </div>
            )}
            <EditorWrapper editorRef={selectorEditorRef} options={INIT_EDITOR_OPTIONS.selector} />
          </>
        }
        rightBottom={
          <>
            <div className="tablist">
              <div className="tab active">
                <FileTypeJsonIcon />
                <span className="tabname">output</span>
                <span style={{ width: 16 }} />
              </div>
            </div>
            <EditorWrapper editorRef={outputEditorRef} options={INIT_EDITOR_OPTIONS.output} />
          </>
        }
      />
    </div>
  )
}
