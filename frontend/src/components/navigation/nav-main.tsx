"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useState, useEffect } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  const { state, setOpen } = useSidebar();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    // Initialize with active items open
    const initial: Record<string, boolean> = {};
    items.forEach((item) => {
      if (item.isActive) {
        initial[item.title] = true;
      }
    });
    return initial;
  });
  const [pendingOpen, setPendingOpen] = useState<string | null>(null);

  // Handle opening the menu after sidebar expands
  useEffect(() => {
    if (state === "expanded" && pendingOpen) {
      // Small delay to ensure sidebar animation completes
      const timer = setTimeout(() => {
        setOpenMenus((prev) => ({ ...prev, [pendingOpen]: true }));
        setPendingOpen(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [state, pendingOpen]);

  const handleClick = (itemTitle: string) => {
    if (state === "collapsed") {
      // If collapsed, expand sidebar and mark this item to be opened
      setPendingOpen(itemTitle);
      setOpen(true);
    }
    // If already expanded, the onOpenChange will handle the toggle
  };

  const handleOpenChange = (itemTitle: string, isOpen: boolean) => {
    setOpenMenus((prev) => ({ ...prev, [itemTitle]: isOpen }));
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isOpen = openMenus[item.title] || false;

          return (
            <Collapsible
              key={item.title}
              asChild
              open={isOpen}
              onOpenChange={(open) => handleOpenChange(item.title, open)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={item.title}
                    onClick={() => handleClick(item.title)}
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild>
                          <a href={subItem.url}>
                            <span>{subItem.title}</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
