import { Component } from 'react'
import type { ReactNode } from 'react'

export default class SceneBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <div className="scene-message" role="alert"><span className="eyebrow">RENDERER INTERRUPTED</span><h2>The city needs a moment.</h2><p>The 3D renderer could not start. The landmark list is still available.</p><button className="primary-button" onClick={this.props.onRetry}>Retry 3D view <span aria-hidden>↗</span></button></div>
    return this.props.children
  }
}
