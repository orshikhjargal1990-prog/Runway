import React, { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Challenge } from '../types';
import { colors, radius } from '../theme';

type Props = {
  challenges: Challenge[];
  joinedChallengeIds: string[];
  onOpenChallenge: (challenge: Challenge) => void;
  onRegisterChallenge: (challenge: Challenge) => void;
};

type ShopCategory = 'all' | 'shoes' | 'wear' | 'gear' | 'events';
type CheckoutStep = 'cart' | 'delivery' | 'payment' | 'done';

type ShopProduct = {
  id: string;
  title: string;
  brand: string;
  category: ShopCategory;
  price: string;
  badge: string;
  image: string;
  accent: string;
  description: string;
  storeName: string;
  storeAddress: string;
};

const categories: { id: ShopCategory; label: string }[] = [
  { id: 'all', label: 'Бүгд' },
  { id: 'shoes', label: 'Пүүз' },
  { id: 'wear', label: 'Хувцас' },
  { id: 'gear', label: 'Хэрэгсэл' },
  { id: 'events', label: 'Event' }
];

const products: ShopProduct[] = [
  { id: 'shoe-carbon', title: 'Carbon Race Pro', brand: 'RunBoost', category: 'shoes', price: '399,000₮', badge: 'Race day', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=80', accent: '#EF476F', description: 'Тэмцээний өдөрт зориулсан carbon plate-тэй хөнгөн пүүз. Хурдны ажил, 5К-42К уралдаанд тохиромжтой.', storeName: 'RunBoost Flagship Store', storeAddress: 'Улаанбаатар, Сүхбаатар дүүрэг, Олимпын гудамж 12, 1 давхар' },
  { id: 'shoe-daily', title: 'Daily Trainer 2', brand: 'StrideLab', category: 'shoes', price: '249,000₮', badge: 'Daily', image: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=900&q=80', accent: '#4663E6', description: 'Өдөр тутмын бэлтгэлд зориулагдсан зөөлөн ултай trainer. Урт гүйлт болон сэргээх гүйлтэд эвтэйхэн.', storeName: 'StrideLab Mongolia', storeAddress: 'Улаанбаатар, Хан-Уул дүүрэг, Наадам центр, B1 спорт тасаг' },
  { id: 'singlet', title: 'Marathon Singlet', brand: 'RunBoost Wear', category: 'wear', price: '79,000₮', badge: 'Light', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80', accent: '#22C55E', description: 'Амьсгалдаг, хурдан хатдаг marathon singlet. Халуун өдөр болон indoor бэлтгэлд тохиромжтой.', storeName: 'RunBoost Wear Corner', storeAddress: 'Улаанбаатар, Баянзүрх дүүрэг, Sunday Plaza, 2 давхар 214 тоот' },
  { id: 'vest', title: 'Hydration Vest', brand: 'TrailKit', category: 'gear', price: '189,000₮', badge: 'Ultra', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=900&q=80', accent: '#F5B82E', description: 'Trail болон ultra гүйлтэд зориулсан усны сав, жижиг хэрэгсэл хийх олон халаастай vest.', storeName: 'TrailKit Outdoor Store', storeAddress: 'Улаанбаатар, Чингэлтэй дүүрэг, Жуулчны гудамж 5, Outdoor section' },
  { id: 'watch', title: 'GPS Run Watch', brand: 'PaceOS', category: 'gear', price: '599,000₮', badge: 'GPS', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=80', accent: '#06B6D4', description: 'GPS, pace, heart-rate, route tracking дэмждэг гүйлтийн цаг. Training plan болон recovery үзүүлэлттэй.', storeName: 'PaceOS Tech Store', storeAddress: 'Улаанбаатар, Сүхбаатар дүүрэг, Shangri-La Mall, 3 давхар Tech zone' },
  { id: 'bib-pack', title: 'Marathon Bib Pack', brand: 'RunBoost Event', category: 'events', price: '45,000₮', badge: 'Bib + Medal', image: 'https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=900&q=80', accent: '#A8FF18', description: 'Марафон event-ийн bib, medal, timing бүртгэл болон race day starter pack багтсан багц.', storeName: 'RunBoost Event Desk', storeAddress: 'Улаанбаатар, Үндэсний цэцэрлэгт хүрээлэн, Event registration tent' }
];

function parsePrice(price: string) {
  return Number(price.replace(/[^\d]/g, '')) || 0;
}

function formatPrice(value: number) {
  return `${value.toLocaleString('mn-MN')}₮`;
}

function ProductCard({ product, inCart, onToggle, onOpenDetail }: { product: ShopProduct; inCart: boolean; onToggle: (id: string) => void; onOpenDetail: (product: ShopProduct) => void }) {
  return (
    <View style={styles.productCard}>
      <View style={styles.productImageWrap}>
        <Image source={{ uri: product.image }} style={styles.productImage} />
        <View style={[styles.productBadge, { backgroundColor: product.accent }]}>
          <Text style={styles.productBadgeText}>{product.badge}</Text>
        </View>
      </View>
      <View style={styles.productBody}>
        <Text style={styles.productBrand}>{product.brand}</Text>
        <Text style={styles.productTitle} numberOfLines={2}>{product.title}</Text>
        <View style={styles.productFooter}>
          <Text style={styles.productPrice}>{product.price}</Text>
          <View style={styles.productActions}>
            <Pressable style={styles.detailButton} onPress={() => onOpenDetail(product)}>
              <Text style={styles.detailButtonText}>Дэлгэрэнгүй</Text>
            </Pressable>
            <Pressable style={[styles.cartButton, inCart && styles.cartButtonActive]} onPress={() => onToggle(product.id)}>
              <Text style={[styles.cartButtonText, inCart && styles.cartButtonTextActive]}>{inCart ? 'Сагсанд' : 'Нэмэх'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export function ExploreScreen(_: Props) {
  const [activeCategory, setActiveCategory] = useState<ShopCategory>('all');
  const [cartIds, setCartIds] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('cart');
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [paymentType, setPaymentType] = useState<'qpay' | 'card'>('qpay');
  const visibleProducts = useMemo(
    () => activeCategory === 'all' ? products : products.filter(product => product.category === activeCategory),
    [activeCategory]
  );
  const cartItems = useMemo(
    () => cartIds.map(id => products.find(product => product.id === id)).filter((product): product is ShopProduct => Boolean(product)),
    [cartIds]
  );
  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + parsePrice(item.price), 0), [cartItems]);
  const toggleCart = (id: string) => setCartIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const openCart = () => {
    setCheckoutStep('cart');
    setCartOpen(true);
  };
  const closeCart = () => setCartOpen(false);
  const completeOrder = () => {
    setCheckoutStep('done');
    setCartIds([]);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>RUNBOOST SHOP</Text>
          <Text style={styles.heading}>Гүйлтийн дэлгүүр</Text>
        </View>
        <Pressable style={styles.cartPill} onPress={openCart}>
          <Text style={styles.cartPillText}>{cartIds.length}</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Image source={{ uri: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80' }} style={styles.heroImage} />
        <View style={styles.heroShade}>
          <Text style={styles.heroTitle}>Race day essentials</Text>
          <Text style={styles.heroText}>Пүүз, хувцас, hydration gear болон марафоны event багцууд.</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {categories.map(category => {
          const active = activeCategory === category.id;
          return (
            <Pressable key={category.id} style={[styles.categoryChip, active && styles.categoryChipActive]} onPress={() => setActiveCategory(category.id)}>
              <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{category.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.grid}>
        {visibleProducts.map(product => (
          <ProductCard key={product.id} product={product} inCart={cartIds.includes(product.id)} onToggle={toggleCart} onOpenDetail={setSelectedProduct} />
        ))}
      </View>

      <Modal transparent visible={Boolean(selectedProduct)} animationType="fade" onRequestClose={() => setSelectedProduct(null)}>
        <View style={styles.detailOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedProduct(null)} />
          {selectedProduct ? (
            <View style={styles.detailCard}>
              <Image source={{ uri: selectedProduct.image }} style={styles.detailImage} />
              <View style={[styles.detailBadge, { backgroundColor: selectedProduct.accent }]}><Text style={styles.detailBadgeText}>{selectedProduct.badge}</Text></View>
              <Text style={styles.detailBrand}>{selectedProduct.brand}</Text>
              <Text style={styles.detailTitle}>{selectedProduct.title}</Text>
              <Text style={styles.detailPrice}>{selectedProduct.price}</Text>
              <Text style={styles.detailDescription}>{selectedProduct.description}</Text>
              <View style={styles.storeCard}>
                <Text style={styles.storeLabel}>Зарагдаж буй дэлгүүр</Text>
                <Text style={styles.storeName}>{selectedProduct.storeName}</Text>
                <Text style={styles.storeAddress}>{selectedProduct.storeAddress}</Text>
              </View>
              <View style={styles.detailActions}>
                <Pressable style={styles.detailCloseButton} onPress={() => setSelectedProduct(null)}>
                  <Text style={styles.detailCloseText}>Хаах</Text>
                </Pressable>
                <Pressable style={[styles.detailCartButton, cartIds.includes(selectedProduct.id) && styles.cartButtonActive]} onPress={() => toggleCart(selectedProduct.id)}>
                  <Text style={[styles.detailCartText, cartIds.includes(selectedProduct.id) && styles.cartButtonTextActive]}>{cartIds.includes(selectedProduct.id) ? 'Сагсанд' : 'Сагсанд нэмэх'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal transparent visible={cartOpen} animationType="slide" onRequestClose={closeCart}>
        <View style={styles.cartOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCart} />
          <View style={styles.cartSheet}>
            <View style={styles.cartHeader}>
              <View>
                <Text style={styles.cartKicker}>RUNBOOST CART</Text>
                <Text style={styles.cartTitle}>{checkoutStep === 'done' ? 'Захиалга баталгаажлаа' : 'Таны сагс'}</Text>
              </View>
              <Pressable style={styles.cartCloseButton} onPress={closeCart}>
                <Text style={styles.cartCloseText}>×</Text>
              </Pressable>
            </View>

            {checkoutStep !== 'done' ? (
              <View style={styles.checkoutSteps}>
                {(['cart', 'delivery', 'payment'] as CheckoutStep[]).map((step, index) => {
                  const active = checkoutStep === step;
                  const label = step === 'cart' ? 'Сагс' : step === 'delivery' ? 'Хүлээн авах' : 'Төлбөр';
                  return (
                    <View key={step} style={[styles.checkoutStep, active && styles.checkoutStepActive]}>
                      <Text style={[styles.checkoutStepText, active && styles.checkoutStepTextActive]}>{index + 1}. {label}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {checkoutStep === 'cart' ? (
              <>
                <ScrollView style={styles.cartList} showsVerticalScrollIndicator={false}>
                  {cartItems.length ? cartItems.map(item => (
                    <View key={item.id} style={styles.cartItem}>
                      <Image source={{ uri: item.image }} style={styles.cartItemImage} />
                      <View style={styles.cartItemBody}>
                        <Text style={styles.cartItemBrand}>{item.brand}</Text>
                        <Text style={styles.cartItemTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.cartItemStore} numberOfLines={1}>{item.storeName}</Text>
                        <Text style={styles.cartItemPrice}>{item.price}</Text>
                      </View>
                      <Pressable style={styles.removeCartButton} onPress={() => toggleCart(item.id)}>
                        <Text style={styles.removeCartText}>Устгах</Text>
                      </Pressable>
                    </View>
                  )) : (
                    <View style={styles.emptyCart}>
                      <Text style={styles.emptyCartTitle}>Сагс хоосон байна</Text>
                      <Text style={styles.emptyCartText}>Бараа сонгоод “Нэмэх” товч дарна уу.</Text>
                    </View>
                  )}
                </ScrollView>
                <View style={styles.cartSummary}>
                  <Text style={styles.summaryLabel}>Нийт дүн</Text>
                  <Text style={styles.summaryValue}>{formatPrice(cartTotal)}</Text>
                </View>
                <Pressable disabled={!cartItems.length} style={[styles.checkoutButton, !cartItems.length && styles.checkoutButtonDisabled]} onPress={() => setCheckoutStep('delivery')}>
                  <Text style={styles.checkoutButtonText}>Худалдан авалт үргэлжлүүлэх</Text>
                </Pressable>
              </>
            ) : null}

            {checkoutStep === 'delivery' ? (
              <>
                <View style={styles.optionGroup}>
                  <Pressable style={[styles.checkoutOption, deliveryType === 'pickup' && styles.checkoutOptionActive]} onPress={() => setDeliveryType('pickup')}>
                    <Text style={styles.checkoutOptionTitle}>Дэлгүүрээс авах</Text>
                    <Text style={styles.checkoutOptionText}>Бараа бүрийн зарагдаж буй дэлгүүр дээр очиж авна.</Text>
                  </Pressable>
                  <Pressable style={[styles.checkoutOption, deliveryType === 'delivery' && styles.checkoutOptionActive]} onPress={() => setDeliveryType('delivery')}>
                    <Text style={styles.checkoutOptionTitle}>Хүргэлтээр авах</Text>
                    <Text style={styles.checkoutOptionText}>Улаанбаатар хот дотор хүргэлтийн ажилтан холбогдоно.</Text>
                  </Pressable>
                </View>
                <View style={styles.storeRouteCard}>
                  <Text style={styles.storeRouteTitle}>Дэлгүүрийн мэдээлэл</Text>
                  {cartItems.map(item => (
                    <Text key={item.id} style={styles.storeRouteText}>• {item.storeName}: {item.storeAddress}</Text>
                  ))}
                </View>
                <View style={styles.checkoutNav}>
                  <Pressable style={styles.backCheckoutButton} onPress={() => setCheckoutStep('cart')}><Text style={styles.backCheckoutText}>Буцах</Text></Pressable>
                  <Pressable style={styles.nextCheckoutButton} onPress={() => setCheckoutStep('payment')}><Text style={styles.nextCheckoutText}>Төлбөр рүү</Text></Pressable>
                </View>
              </>
            ) : null}

            {checkoutStep === 'payment' ? (
              <>
                <View style={styles.optionGroup}>
                  <Pressable style={[styles.checkoutOption, paymentType === 'qpay' && styles.checkoutOptionActive]} onPress={() => setPaymentType('qpay')}>
                    <Text style={styles.checkoutOptionTitle}>QPay төлбөр</Text>
                    <Text style={styles.checkoutOptionText}>QR үүсгээд банкны апп-аар төлнө.</Text>
                  </Pressable>
                  <Pressable style={[styles.checkoutOption, paymentType === 'card' && styles.checkoutOptionActive]} onPress={() => setPaymentType('card')}>
                    <Text style={styles.checkoutOptionTitle}>Карт</Text>
                    <Text style={styles.checkoutOptionText}>Картын төлбөрийн demo баталгаажуулалт.</Text>
                  </Pressable>
                </View>
                <View style={styles.paymentBox}>
                  <Text style={styles.paymentLabel}>Төлөх дүн</Text>
                  <Text style={styles.paymentAmount}>{formatPrice(cartTotal)}</Text>
                  <Text style={styles.paymentHint}>{paymentType === 'qpay' ? 'QPay QR demo үүсгэгдэнэ.' : 'Картын demo төлбөр баталгаажна.'}</Text>
                </View>
                <View style={styles.checkoutNav}>
                  <Pressable style={styles.backCheckoutButton} onPress={() => setCheckoutStep('delivery')}><Text style={styles.backCheckoutText}>Буцах</Text></Pressable>
                  <Pressable style={styles.nextCheckoutButton} onPress={completeOrder}><Text style={styles.nextCheckoutText}>Захиалах</Text></Pressable>
                </View>
              </>
            ) : null}

            {checkoutStep === 'done' ? (
              <View style={styles.doneCard}>
                <View style={styles.doneMark}><Text style={styles.doneMarkText}>✓</Text></View>
                <Text style={styles.doneTitle}>Захиалга амжилттай</Text>
                <Text style={styles.doneText}>Таны худалдан авалтын хүсэлт бүртгэгдлээ. Дэлгүүрийн ажилтан баталгаажуулж холбогдох болно.</Text>
                <Pressable style={styles.checkoutButton} onPress={closeCart}>
                  <Text style={styles.checkoutButtonText}>Ойлголоо</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 122 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  heading: { color: colors.text, fontSize: 29, fontWeight: '900', marginTop: 4 },
  cartPill: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  cartPillText: { color: '#102014', fontSize: 15, fontWeight: '900' },
  hero: { height: 166, borderRadius: 22, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  heroImage: { width: '100%', height: '100%', position: 'absolute' },
  heroShade: { flex: 1, justifyContent: 'flex-end', padding: 16, backgroundColor: 'rgba(0,0,0,0.42)' },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  heroText: { color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 17, fontWeight: '800', marginTop: 6 },
  categoryRow: { gap: 8, paddingBottom: 15 },
  categoryChip: { height: 36, borderRadius: 18, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  categoryChipActive: { backgroundColor: colors.accent, borderColor: 'rgba(255,255,255,0.5)' },
  categoryText: { color: '#C8D8DE', fontSize: 12, fontWeight: '900' },
  categoryTextActive: { color: '#102014' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productCard: { width: '48%', minHeight: 242, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  productImageWrap: { height: 126, backgroundColor: '#E2E8F0' },
  productImage: { width: '100%', height: '100%' },
  productBadge: { position: 'absolute', left: 9, top: 9, minHeight: 24, borderRadius: 12, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  productBadgeText: { color: '#081014', fontSize: 9, fontWeight: '900' },
  productBody: { flex: 1, padding: 12 },
  productBrand: { color: '#64748B', fontSize: 9, fontWeight: '900' },
  productTitle: { color: '#0F172A', fontSize: 15, lineHeight: 19, fontWeight: '900', marginTop: 4 },
  productFooter: { marginTop: 'auto', gap: 10 },
  productPrice: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  productActions: { gap: 7 },
  detailButton: { height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' },
  detailButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  cartButton: { height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E8F0' },
  cartButtonActive: { backgroundColor: colors.accent },
  cartButtonText: { color: '#334155', fontSize: 12, fontWeight: '900' },
  cartButtonTextActive: { color: '#102014' },
  detailOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.68)' },
  detailCard: { width: '100%', maxWidth: 430, maxHeight: '92%', borderRadius: 24, overflow: 'hidden', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  detailImage: { width: '100%', height: 190, backgroundColor: '#E2E8F0' },
  detailBadge: { position: 'absolute', left: 14, top: 14, minHeight: 26, borderRadius: 13, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  detailBadgeText: { color: '#081014', fontSize: 10, fontWeight: '900' },
  detailBrand: { color: '#64748B', fontSize: 10, fontWeight: '900', marginTop: 16, marginHorizontal: 16 },
  detailTitle: { color: '#0F172A', fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 4, marginHorizontal: 16 },
  detailPrice: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginTop: 8, marginHorizontal: 16 },
  detailDescription: { color: '#475569', fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: 12, marginHorizontal: 16 },
  storeCard: { margin: 16, marginBottom: 12, borderRadius: 18, padding: 14, backgroundColor: '#E2E8F0', borderWidth: 1, borderColor: '#CBD5E1' },
  storeLabel: { color: '#64748B', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  storeName: { color: '#0F172A', fontSize: 15, fontWeight: '900', marginTop: 6 },
  storeAddress: { color: '#475569', fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 5 },
  detailActions: { flexDirection: 'row', gap: 9, paddingHorizontal: 16, paddingBottom: 16 },
  detailCloseButton: { flex: 0.8, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E8F0' },
  detailCloseText: { color: '#334155', fontSize: 13, fontWeight: '900' },
  detailCartButton: { flex: 1.3, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' },
  detailCartText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  cartOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.68)' },
  cartSheet: { maxHeight: '88%', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, backgroundColor: '#071016', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  cartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cartKicker: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  cartTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 4 },
  cartCloseButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  cartCloseText: { color: colors.text, fontSize: 30, lineHeight: 32, fontWeight: '800' },
  checkoutSteps: { flexDirection: 'row', gap: 7, marginTop: 16, marginBottom: 12 },
  checkoutStep: { flex: 1, minHeight: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  checkoutStepActive: { backgroundColor: colors.accent, borderColor: 'rgba(255,255,255,0.4)' },
  checkoutStepText: { color: '#BFD0D6', fontSize: 10, fontWeight: '900' },
  checkoutStepTextActive: { color: '#071016' },
  cartList: { maxHeight: 310, marginTop: 4 },
  cartItem: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, padding: 10, marginBottom: 9, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  cartItemImage: { width: 68, height: 68, borderRadius: 14, backgroundColor: '#E2E8F0' },
  cartItemBody: { flex: 1, minWidth: 0 },
  cartItemBrand: { color: '#9FB2B9', fontSize: 9, fontWeight: '900' },
  cartItemTitle: { color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: '900', marginTop: 3 },
  cartItemStore: { color: 'rgba(255,255,255,0.58)', fontSize: 10, fontWeight: '700', marginTop: 4 },
  cartItemPrice: { color: colors.accent, fontSize: 13, fontWeight: '900', marginTop: 5 },
  removeCartButton: { height: 32, borderRadius: 16, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239,68,68,0.14)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' },
  removeCartText: { color: '#FCA5A5', fontSize: 10, fontWeight: '900' },
  emptyCart: { minHeight: 160, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  emptyCartTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  emptyCartText: { color: 'rgba(255,255,255,0.64)', fontSize: 12, fontWeight: '700', marginTop: 6 },
  cartSummary: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 18, paddingHorizontal: 14, marginTop: 8, backgroundColor: 'rgba(168,255,24,0.12)', borderWidth: 1, borderColor: 'rgba(168,255,24,0.3)' },
  summaryLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 12, fontWeight: '900' },
  summaryValue: { color: colors.accent, fontSize: 18, fontWeight: '900' },
  checkoutButton: { height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, marginTop: 12 },
  checkoutButtonDisabled: { opacity: 0.45 },
  checkoutButtonText: { color: '#071016', fontSize: 14, fontWeight: '900' },
  optionGroup: { gap: 10, marginTop: 10 },
  checkoutOption: { minHeight: 78, borderRadius: 18, padding: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  checkoutOptionActive: { borderColor: 'rgba(168,255,24,0.76)', backgroundColor: 'rgba(168,255,24,0.13)' },
  checkoutOptionTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  checkoutOptionText: { color: 'rgba(255,255,255,0.66)', fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 5 },
  storeRouteCard: { maxHeight: 170, borderRadius: 18, padding: 14, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  storeRouteTitle: { color: colors.accent, fontSize: 12, fontWeight: '900', marginBottom: 7 },
  storeRouteText: { color: 'rgba(255,255,255,0.72)', fontSize: 11, lineHeight: 17, fontWeight: '700', marginTop: 3 },
  checkoutNav: { flexDirection: 'row', gap: 10, marginTop: 14 },
  backCheckoutButton: { flex: 0.85, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  backCheckoutText: { color: '#DCE8EC', fontSize: 13, fontWeight: '900' },
  nextCheckoutButton: { flex: 1.25, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  nextCheckoutText: { color: '#071016', fontSize: 13, fontWeight: '900' },
  paymentBox: { alignItems: 'center', borderRadius: 20, padding: 18, marginTop: 12, backgroundColor: 'rgba(168,255,24,0.12)', borderWidth: 1, borderColor: 'rgba(168,255,24,0.3)' },
  paymentLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 11, fontWeight: '900' },
  paymentAmount: { color: colors.accent, fontSize: 30, fontWeight: '900', marginTop: 5 },
  paymentHint: { color: 'rgba(255,255,255,0.66)', fontSize: 12, fontWeight: '700', marginTop: 6 },
  doneCard: { alignItems: 'center', paddingVertical: 22 },
  doneMark: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(168,255,24,0.16)', borderWidth: 1, borderColor: 'rgba(168,255,24,0.5)' },
  doneMarkText: { color: colors.accent, fontSize: 28, fontWeight: '900' },
  doneTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 14 },
  doneText: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 20, fontWeight: '700', textAlign: 'center', marginTop: 8 }
});
