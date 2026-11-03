import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
export default class ExperienceBoundary extends Component<{children: ReactNode; onError: () => void}, {failed: boolean}> {
 state = { failed: false }
 static getDerivedStateFromError() { return { failed: true } }
 componentDidCatch(_error: Error, _info: ErrorInfo) { this.props.onError() }
 render() { return this.state.failed ? null : this.props.children }
}
