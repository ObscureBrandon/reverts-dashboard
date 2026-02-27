'use client';

import { Button } from '@/components/ui/button';
import { useUserRole } from '@/lib/hooks/queries/useUserRole';
import { cn } from '@/lib/utils';
import { Home, Menu, MessageSquare, Ticket, Users, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef, useState } from 'react';

// Full nav items for mods
const modNavItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/tickets', label: 'Tickets', icon: Ticket },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
];

// Limited nav items for regular users
const userNavItems = [
  { href: '/my-tickets', label: 'My Tickets', icon: Ticket },
];

export function NavigationHeader() {
  const pathname = usePathname();
  const { isMod, isLoading } = useUserRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Select nav items based on role
  const navItems = isLoading ? [] : isMod ? modNavItems : userNavItems;
  
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

  // Determine which items to show in the desktop nav (skip Home for mods)
  const desktopNavItems = isMod ? navItems.slice(1) : navItems;
  const desktopActiveOffset = isMod ? 1 : 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Accent gradient line at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/30 via-emerald-500 to-emerald-500/30" />
      
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Logo/Brand */}
          <Link 
            href={isMod ? '/' : '/my-tickets'}
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
            {desktopNavItems.map((item, index) => {
              const isActive = activeIndex === index + desktopActiveOffset;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  ref={(el) => { navRefs.current[index + desktopActiveOffset] = el; }}
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
            {activeIndex >= desktopActiveOffset && (
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

        {/* Mobile Navigation - Overlay */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="md:hidden fixed inset-0 top-[57px] bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Menu */}
            <nav className="md:hidden absolute left-0 right-0 top-full bg-background border-b border-border shadow-lg z-50">
              <div className="max-w-7xl mx-auto px-4 py-4">
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
              </div>
            </nav>
          </>
        )}
      </div>
    </header>
  );
}
