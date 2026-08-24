import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PanelNav } from './PanelNav'

describe('PanelNav', () => {
  it('affiche un lien vers chacune des 3 autres modales', () => {
    render(<PanelNav current="personnalisation" onNavigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Comportement' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Historique' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument()
  })

  it("n'affiche pas de lien vers la modale actuelle", () => {
    render(<PanelNav current="personnalisation" onNavigate={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Personnalisation' })).not.toBeInTheDocument()
  })

  it('affiche les 3 autres liens quand la modale actuelle est "comportement"', () => {
    render(<PanelNav current="comportement" onNavigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Personnalisation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Historique' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Comportement' })).not.toBeInTheDocument()
  })

  it('affiche les 3 autres liens quand la modale actuelle est "historique"', () => {
    render(<PanelNav current="historique" onNavigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Personnalisation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comportement' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Historique' })).not.toBeInTheDocument()
  })

  it('affiche les 3 autres liens quand la modale actuelle est "actions"', () => {
    render(<PanelNav current="actions" onNavigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Personnalisation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comportement' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Historique' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument()
  })

  it('appelle onNavigate avec la bonne cible au clic', () => {
    const onNavigate = vi.fn()
    render(<PanelNav current="personnalisation" onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Historique' }))
    expect(onNavigate).toHaveBeenCalledWith('historique')
  })
})
