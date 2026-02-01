'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Home, Menu, MessageSquare, Ticket, Users, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef, useState } from 'react';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/tickets', label: 'Tickets', icon: Ticket },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
];

export function NavigationHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Refs for measuring nav link positions for sliding underline
  const navContainerRef = useRef<HTMLDivElement>(null);
  const navRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });

  // Find active nav item index
  const activeIndex = navItems.findIndex((item) => {
    if (item.href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(item.href);
  });

  // Update underline position when active route changes
  useLayoutEffect(() => {
    const activeNav = navRefs.current[activeIndex];
    const container = navContainerRef.current;

    if (activeNav && container && activeIndex >= 0) {
      const containerRect = container.getBoundingClientRect();
      const navRect = activeNav.getBoundingClientRect();
      setUnderlineStyle({
        left: navRect.left - containerRect.left,
        width: navRect.width,
      });
    } else {
      setUnderlineStyle({ left: 0, width: 0 });
    }
  }, [activeIndex, pathname]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Accent gradient line at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/30 via-emerald-500 to-emerald-500/30" />
      
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Logo/Brand */}
          <Link 
            href="/"
            className="flex items-center gap-2 font-semibold text-foreground hover:text-emerald-600 transition-colors"
          >
            <div className="p-1.5 rounded-md">
              <img src="/reverts_logo_cropped.png" alt="Reverts" className="h-4 w-4 object-contain" />
            </div>
            <span className="hidden sm:inline">Reverts Dashboard</span>
          </Link>

          {/* Desktop Navigation */}
          <nav 
            ref={navContainerRef}
            className="hidden md:flex items-center gap-1 relative"
          >
            {navItems.slice(1).map((item, index) => {
              const isActive = activeIndex === index + 1;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  ref={(el) => { navRefs.current[index + 1] = el; }}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors rounded-md",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            {/* Sliding underline */}
            {activeIndex > 0 && (
              <span
                className="absolute bottom-0 h-0.5 bg-emerald-500 rounded-full transition-all duration-300 ease-out"
                style={{
                  left: underlineStyle.left,
                  width: underlineStyle.width,
                }}
              />
            )}
          </nav>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = item.href === '/' 
                  ? pathname === '/' 
                  : pathname.startsWith(item.href);
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-l-2 border-emerald-500"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
