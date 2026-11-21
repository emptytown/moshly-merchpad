import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/contexts/ThemeContext";
import { DollarSign, Moon, Package, ShoppingCart, Sun, TrendingUp } from "lucide-react";

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ThemeSwitcher() {
  const { skin, mode, setSkin, toggleMode } = useTheme();

  return (
    <div className="fixed top-4 right-4 flex gap-2 z-50">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setSkin(skin === "legacy-purple" ? "neobrut" : "legacy-purple")}
        className="text-xs"
      >
        {skin === "legacy-purple" ? "→ Neobrut" : "→ Legacy Purple"}
      </Button>
      <Button variant="outline" size="sm" onClick={toggleMode} className="text-xs">
        {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default function Home() {
  const { skin, mode } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      <ThemeSwitcher />
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">MerchPad Dashboard</h1>
          <p className="text-muted-foreground">
            Skin: <span className="font-mono font-semibold">{skin}</span> | Mode: <span className="font-mono font-semibold">{mode}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Revenue" value="$1,234.56" icon={DollarSign} />
          <StatCard title="Total Sales" value="48" icon={ShoppingCart} />
          <StatCard title="Stock Remaining" value="1,287" icon={Package} />
          <StatCard title="Products" value="24" icon={TrendingUp} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Theme System</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Available Skins:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><span className="font-mono">legacy-purple</span> — original Moshly electric dark/light theme with purple gradients</li>
                <li><span className="font-mono">neobrut</span> — neo-brutalist: thick ink borders, hard offset shadows, flat colour</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Typography:</h3>
              <p className="text-sm">Standard Inter font for all skins. Heavy display weights and hard shadows in Neobrut.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Colors:</h3>
              <p className="text-sm">
                <strong>Moshly light:</strong> Clean grays (#F9FAFB bg, purple accents) <br />
                <strong>Moshly dark:</strong> Deep electric theme (default) <br />
                <strong>Neobrut:</strong> Driven by --nb-* tokens (light: #FFF6E5 paper, dark: #141414)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
