import { FaGithub } from 'react-icons/fa6'
import { Button } from '@/components/ui/button'

// Watermelon Button 21: keep its GitHub icon button as a link to the project.
export default function Button21() {
  return (
    <Button asChild variant="ghost" size="icon" className="pointer-events-auto size-12 rounded-full bg-white/85 text-foreground shadow-float ring-1 ring-black/5 backdrop-blur-md hover:bg-white motion-reduce:transition-none">
      <a href="https://github.com/FrisoWiegersma/FashMap" target="_blank" rel="noopener noreferrer" aria-label="View FashMap on GitHub (opens in a new tab)" title="View on GitHub">
        <FaGithub className="size-5" />
      </a>
    </Button>
  )
}
