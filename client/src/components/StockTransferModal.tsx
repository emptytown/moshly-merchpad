/**
 * StockTransferModal
 * Design: Neon Ledger — dark glass, Moshly purple/magenta accents
 *
 * Allows transferring stock between Warehouse and On The Road tiers.
 * Supports:
 *   - Per-variant transfer (single row)
 *   - Per-product transfer (all variants at once)
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowRight, ArrowLeft, Warehouse, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useMerchPad } from '@/contexts/MerchPadContext';
import { Product, ProductVariant } from '@/lib/db';

interface Props {
  product: Product;
  open: boolean;
  onClose: () => void;
}

interface VariantTransfer {
  variantId: string;
  qty: string; // string for input control
}

export default function StockTransferModal({ product, open, onClose }: Props) {
  const { transferStock } = useMerchPad();
  const [direction, setDirection] = useState<'to_road' | 'to_warehouse'>('to_road');
  const [tab, setTab] = useState<'product' | 'variant'>('product');

  // Per-product: single qty applied to all variants
  const [productQty, setProductQty] = useState('');

  // Per-variant: individual qty per variant
  const [variantQtys, setVariantQtys] = useState<VariantTransfer[]>(
    product.variants.map(v => ({ variantId: v.id, qty: '' }))
  );

  function updateVariantQty(variantId: string, qty: string) {
    setVariantQtys(prev => prev.map(vt => vt.variantId === variantId ? { ...vt, qty } : vt));
  }

  function getVariant(id: string): ProductVariant | undefined {
    return product.variants.find(v => v.id === id);
  }

  function maxQty(v: ProductVariant): number {
    return direction === 'to_road' ? v.warehouseStock : v.roadStock;
  }

  async function handleProductTransfer() {
    const qty = parseInt(productQty);
    if (isNaN(qty) || qty <= 0) { toast.error('Enter a valid quantity'); return; }

    let errors = 0;
    for (const v of product.variants) {
      const available = maxQty(v);
      const transferQty = Math.min(qty, available);
      if (transferQty > 0) {
        await transferStock(v.id, product.id, v.name, direction, transferQty);
      } else {
        errors++;
      }
    }

    if (errors === product.variants.length) {
      toast.error(`No stock available to transfer ${direction === 'to_road' ? 'from Warehouse' : 'from Road'}`);
    } else {
      toast.success(`Transferred ${qty} units per variant (${direction === 'to_road' ? 'Warehouse → Road' : 'Road → Warehouse'})`);
      setProductQty('');
      onClose();
    }
  }

  async function handleVariantTransfer() {
    const transfers = variantQtys.filter(vt => {
      const qty = parseInt(vt.qty);
      return !isNaN(qty) && qty > 0;
    });

    if (transfers.length === 0) { toast.error('Enter at least one quantity to transfer'); return; }

    let success = 0;
    for (const vt of transfers) {
      const qty = parseInt(vt.qty);
      const v = getVariant(vt.variantId);
      if (!v) continue;
      const available = maxQty(v);
      if (qty > available) {
        toast.error(`${v.name}: only ${available} available`);
        continue;
      }
      await transferStock(v.id, product.id, v.name, direction, qty);
      success++;
    }

    if (success > 0) {
      toast.success(`Transferred ${success} variant${success > 1 ? 's' : ''} (${direction === 'to_road' ? 'Warehouse → Road' : 'Road → Warehouse'})`);
      setVariantQtys(product.variants.map(v => ({ variantId: v.id, qty: '' })));
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#0f1117] border border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <span className="text-purple-400">⇄</span> Stock Transfer — {product.name}
          </DialogTitle>
        </DialogHeader>

        {/* Direction toggle */}
        <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
          <button
            onClick={() => setDirection('to_road')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              direction === 'to_road'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Warehouse className="w-4 h-4" />
            <ArrowRight className="w-3 h-3" />
            <Truck className="w-4 h-4" />
            Warehouse → Road
          </button>
          <button
            onClick={() => setDirection('to_warehouse')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              direction === 'to_warehouse'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Warehouse className="w-4 h-4" />
            <ArrowLeft className="w-3 h-3" />
            <Truck className="w-4 h-4" />
            Road → Warehouse
          </button>
        </div>

        {/* Tab: product-level vs variant-level */}
        <Tabs value={tab} onValueChange={v => setTab(v as 'product' | 'variant')}>
          <TabsList className="bg-white/5 w-full">
            <TabsTrigger value="product" className="flex-1 data-[state=active]:bg-white/10">All Variants</TabsTrigger>
            <TabsTrigger value="variant" className="flex-1 data-[state=active]:bg-white/10">Per Variant</TabsTrigger>
          </TabsList>

          {/* Product-level transfer */}
          <TabsContent value="product" className="mt-4 space-y-4">
            <p className="text-sm text-white/50">
              Transfer the same quantity from each variant's{' '}
              <span className={direction === 'to_road' ? 'text-purple-400' : 'text-amber-400'}>
                {direction === 'to_road' ? 'Warehouse' : 'Road'} stock
              </span>.
            </p>

            {/* Stock overview */}
            <div className="space-y-2">
              {product.variants.map(v => (
                <div key={v.id} className="flex items-center justify-between text-xs bg-white/5 rounded px-3 py-2">
                  <span className="text-white/70">{v.name}</span>
                  <div className="flex gap-3">
                    <span className="text-purple-300">WH: {v.warehouseStock ?? 0}</span>
                    <span className="text-green-300">Road: {v.roadStock ?? v.currentStock}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                type="number"
                min="1"
                placeholder="Qty per variant"
                value={productQty}
                onChange={e => setProductQty(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
              <Button
                onClick={handleProductTransfer}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white shrink-0"
              >
                Transfer
              </Button>
            </div>
          </TabsContent>

          {/* Per-variant transfer */}
          <TabsContent value="variant" className="mt-4 space-y-3">
            <p className="text-sm text-white/50">Set individual quantities for each variant.</p>
            {product.variants.map(v => {
              const vt = variantQtys.find(x => x.variantId === v.id);
              return (
                <div key={v.id} className="bg-white/5 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{v.name}</span>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-purple-300 border-purple-400/30 text-xs">
                        WH {v.warehouseStock ?? 0}
                      </Badge>
                      <Badge variant="outline" className="text-green-300 border-green-400/30 text-xs">
                        Road {v.roadStock ?? v.currentStock}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      max={maxQty(v)}
                      placeholder={`Max ${maxQty(v)}`}
                      value={vt?.qty ?? ''}
                      onChange={e => updateVariantQty(v.id, e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-8 text-sm"
                    />
                  </div>
                </div>
              );
            })}
            <Button
              onClick={handleVariantTransfer}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white"
            >
              Transfer Selected
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
