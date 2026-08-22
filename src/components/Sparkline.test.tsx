import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Sparkline } from './Sparkline'

describe('Sparkline', () => {
  it('trace une ligne reliant tous les points', () => {
    const { container } = render(
      <Sparkline
        points={[
          { t: 0, v: 0 },
          { t: 1, v: 5 },
          { t: 2, v: 3 },
        ]}
        color="#2563eb"
      />
    )
    const line = container.querySelector('path[stroke="#2563eb"]')
    expect(line).toBeInTheDocument()
    // M (départ) + 2 L (un par point suivant) = 3 commandes de tracé.
    expect(line?.getAttribute('d')?.match(/[ML]/g)).toHaveLength(3)
  })

  it('place le point final (cercle) à la dernière valeur', () => {
    const { container } = render(
      <Sparkline
        points={[
          { t: 0, v: 0 },
          { t: 1, v: 10 },
        ]}
        color="#2563eb"
      />
    )
    const circle = container.querySelector('circle')
    // Dernier point (v=10, max) : proche du haut du graphique (padding = 6px).
    expect(circle).toHaveAttribute('cy', '6')
  })

  it("n'échoue pas quand la valeur est restée constante (ligne plate)", () => {
    const { container } = render(
      <Sparkline
        points={[
          { t: 0, v: 4 },
          { t: 1, v: 4 },
          { t: 2, v: 4 },
        ]}
        color="#2563eb"
      />
    )
    const line = container.querySelector('path[stroke="#2563eb"]')
    expect(line?.getAttribute('d')).not.toContain('NaN')
  })

  it('annonce la plage de valeurs de manière accessible', () => {
    const { container } = render(
      <Sparkline
        points={[
          { t: 0, v: 2 },
          { t: 1, v: 9 },
        ]}
        color="#2563eb"
      />
    )
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-label',
      'Évolution du compteur : de 2 à 9'
    )
  })

  it('utilise la couleur fournie pour la ligne, le remplissage et le point final', () => {
    const { container } = render(
      <Sparkline
        points={[
          { t: 0, v: 0 },
          { t: 1, v: 1 },
        ]}
        color="#7c3aed"
      />
    )
    expect(container.querySelector('path[fill="#7c3aed"]')).toBeInTheDocument()
    expect(container.querySelector('circle[fill="#7c3aed"]')).toBeInTheDocument()
  })
})
