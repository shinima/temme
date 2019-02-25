import classNames from 'classnames'
import React from 'react'
import * as actions from './actions'
import { Action } from './actions'
import {
  AddFolderIcon,
  DeleteIcon,
  DownloadIcon,
  FolderIcon,
  FolderOpenIcon,
  RenameIcon,
} from './icons'
import { State } from './interfaces'
import './Sidebar.styl'

export interface SidebarProps {
  state: State
  readonly: boolean
  dispatch(action: Action): void
}

export default function Sidebar({ state, dispatch, readonly }: SidebarProps) {
  const { project, pages, activePageId } = state

  // TODO 有更好的方法判断 project 是否加载完毕
  const name = project._id ? project.name : 'loading...'
  const description = project._id ? project.description : 'loading...'

  return (
    <div className="sidebar">
      <header>
        <h1 className="title">
          <span>{name}</span>
          <div className="actions">
            <DownloadIcon size={16} onClick={() => dispatch(actions.requestDownloadProject())} />
          </div>
        </h1>
        <p className="description">
          {description || <span style={{ color: '#777' }}>(暂无描述)</span>}
        </p>
      </header>
      <div className="view-container">
        <div className="view folders-view">
          <div className="view-title">
            <h2 style={{ display: 'flex', alignItems: 'baseline' }}>
              页面列表
              {pages.some(p => p.isModified()) && <div className="modify-hint">部分页面未保存</div>}
            </h2>
            {!readonly && (
              <div className="actions">
                <AddFolderIcon onClick={() => dispatch(actions.requestAddPage())} />
              </div>
            )}
          </div>
          <div className="view-content">
            <ul className="folder-list">
              {pages
                .sortBy(page => page._id)
                .map(page => {
                  const { _id: pageId, name } = page
                  return (
                    <li
                      key={pageId}
                      className={classNames({ active: pageId === activePageId })}
                      onClick={() => dispatch(actions.openPage(pageId))}
                    >
                      {pageId === activePageId ? <FolderOpenIcon /> : <FolderIcon />}
                      <div className="page-name-wrapper">
                        <div className="page-name">{name}</div>
                        <div className="modify-hint">{page.isModified() && '未保存'}</div>
                      </div>
                      {!readonly && (
                        <span className="actions">
                          <RenameIcon
                            onClick={() => dispatch(actions.requestUpdatePageMeta(pageId))}
                          />
                          <DeleteIcon onClick={() => dispatch(actions.requestDeletePage(pageId))} />
                        </span>
                      )}
                    </li>
                  )
                })
                .valueSeq()}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
