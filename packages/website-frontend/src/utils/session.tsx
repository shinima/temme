import React, { createContext, Component, useContext, Provider, useState, useEffect } from 'react'
import * as server from './server'

interface SessionContext {
  username: string
  userId: number
  connected: boolean
  login: () => void
  logout: () => void
}
interface Session {
  username: string
  userId: number
  connected: boolean
}
const defaultSession: Session = {
  username: null,
  userId: -1,
  connected: false,
}
const SessionContext = createContext(null as SessionContext)

export function SessionProvider({ children }: { children: JSX.Element }) {
  const [sessionState, setSessionState] = useState(defaultSession)

  async function login() {
    const { clientId } = await server.getClientId()
    window.open(
      `https://github.com/login/oauth/authorize?client_id=${clientId}`,
      '_blank',
      'width=965,height=560,top=250,left=150',
    )
  }

  function logout() {
    setSessionState({
      ...sessionState,
      userId: -1,
      username: null,
    })
    server.logout()
  }

  const fetchLoginInfo = async () => {
    try {
      const { username, userId } = await server.getMyInfo()
      setSessionState({ ...sessionState, username, userId, connected: true })
    } catch (e) {
      console.log('无法连接服务器')
      console.error(e)
    }
  }

  useEffect(() => {
    fetchLoginInfo()
    const receiveMessage = (event: MessageEvent) => {
      if (event.data.userId && event.data.username) {
        const {username,userId}: Session = event.data
        setSessionState({ ...sessionState, username,userId })
      }
    }
    window.addEventListener('message', receiveMessage, false)
    return () => {
      window.removeEventListener('message', receiveMessage)
    }
  }, [sessionState.connected])

  return (
    <SessionContext.Provider value={{ ...sessionState, login, logout }}>
      {children}
    </SessionContext.Provider>
  )
}
export const useSession = () => useContext(SessionContext)