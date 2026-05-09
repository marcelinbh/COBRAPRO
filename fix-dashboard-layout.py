#!/usr/bin/env python3
import re

filepath = '/home/ubuntu/cobrapro/client/src/components/DashboardLayout.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Substituir MobileHeader para receber menuItems como prop
old_mobile_header = r'function MobileHeader\(\) \{\s*const \[location\] = useLocation\(\);\s*const activeItem = menuItems\.find\(item => item\.path === location\);'
new_mobile_header = 'function MobileHeader({ menuItems }: { menuItems: any[] }) {\n  const [location] = useLocation();\n  const activeItem = menuItems.find((item: any) => item.path === location);'
content = re.sub(old_mobile_header, new_mobile_header, content)

# Substituir BottomNav para receber menuItems como prop
old_bottom_nav = r'function BottomNav\(\) \{\s*const \[location\] = useLocation\(\);\s*const filteredMenuItems = menuItems\.filter\(item'
new_bottom_nav = 'function BottomNav({ menuItems }: { menuItems: any[] }) {\n  const [location] = useLocation();\n  const filteredMenuItems = menuItems.filter((item: any)'
content = re.sub(old_bottom_nav, new_bottom_nav, content)

# Substituir chamadas para MobileHeader e BottomNav
content = re.sub(r'<MobileHeader />', '<MobileHeader menuItems={menuItems} />', content)
content = re.sub(r'<BottomNav />', '<BottomNav menuItems={menuItems} />', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ DashboardLayout corrigido!")
