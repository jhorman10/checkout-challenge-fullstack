import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import './App.css';
import { addToCart, clearCart, type Product, updateQuantity } from './store/cartSlice';
import {
  buildPaymentConfirmation,
  buildPurchaseSummary,
  clearConfirmation,
  isCheckoutStepUnlocked,
  isCheckoutStepValid,
  resetCheckout,
  setConfirmation,
  setField,
  setStatus,
  setStep,
  setSubmitting,
  type FormState,
} from './store/checkoutSlice';
import type { AppDispatch, RootState } from './store/store';

const API_BASE_URL = 'http://localhost:3000/api';
const stepLabels = ['Carrito', 'Cliente', 'Entrega', 'Pago', 'Confirmación'];

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const cart = useSelector((state: RootState) => state.cart.items);
  const form = useSelector((state: RootState) => state.checkout.form);
  const currentStep = useSelector((state: RootState) => state.checkout.step);
  const status = useSelector((state: RootState) => state.checkout.status);
  const isSubmitting = useSelector((state: RootState) => state.checkout.isSubmitting);
  const confirmation = useSelector((state: RootState) => state.checkout.confirmation);

  const [products, setProducts] = useState<Product[]>([]);
  const [finalOrderSummary, setFinalOrderSummary] = useState<ReturnType<typeof buildPurchaseSummary> | null>(null);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'backward'>('forward');
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/products`);
        if (!response.ok) {
          throw new Error('No se pudo cargar los productos');
        }
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        dispatch(
          setStatus({
            type: 'error',
            message: error instanceof Error ? error.message : 'Error al cargar los productos',
          }),
        );
      }
    };

    void loadProducts();
  }, [dispatch]);

  const cartItemCount = Object.keys(cart).length;

  const cartItems = useMemo(
    () =>
      products
        .filter((product) => cart[product.id])
        .map((product) => ({ ...product, quantity: cart[product.id] })),
    [cart, products],
  );

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = 9000;
  const handlingFee = 12000;
  const total = subtotal + shippingFee + handlingFee;
  const effectiveCartCount = Math.max(cartItemCount, cartItems.length);

  const canContinue = () => isCheckoutStepValid(currentStep, form, effectiveCartCount);

  const handleFieldChange = (field: keyof FormState, value: string) => {
    dispatch(setField({ field, value }));
  };

  const navigateToStep = (step: number) => {
    setTransitionDirection(step >= currentStep ? 'forward' : 'backward');
    setHasNavigated(true);
    dispatch(setStep(step));
  };

  const goToNextStep = () => {
    if (!canContinue()) {
      dispatch(setStatus({ type: 'error', message: 'Completa los campos obligatorios antes de continuar.' }));
      return;
    }
    dispatch(setStatus({ type: 'idle', message: '' }));
    navigateToStep(currentStep + 1);
  };

  const handleSubmit = async () => {
    if (effectiveCartCount === 0) {
      dispatch(setStatus({ type: 'error', message: 'Agrega al menos un producto antes de pagar.' }));
      return;
    }

    const payload = {
      items: cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
      customer: {
        name: form.name,
        email: form.email,
        documentType: form.documentType,
        documentNumber: form.documentNumber,
      },
      delivery: {
        address: form.address,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        phone: form.phone,
      },
      payment: {
        cardNumber: form.cardNumber,
        holderName: form.holderName,
        expMonth: form.expMonth,
        expYear: form.expYear,
        cvv: form.cvv,
      },
    };

    try {
      dispatch(setSubmitting(true));
      dispatch(setStatus({ type: 'idle', message: '' }));

      const transactionResponse = await fetch(`${API_BASE_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const transactionData = await transactionResponse.json();

      if (!transactionResponse.ok) {
        throw new Error(transactionData.message ?? 'No se pudo crear la transacción.');
      }

      const paymentResponse = await fetch(`${API_BASE_URL}/transactions/${transactionData.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          transactionId: transactionData.id,
        }),
      });

      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok || !paymentData.success) {
        throw new Error(paymentData.message ?? 'El pago fue rechazado.');
      }

      const paymentConfirmation = buildPaymentConfirmation({
        reference: paymentData.transaction.reference,
        amount: total,
        customerName: form.name,
        customerEmail: form.email,
      });

      const purchasedSummary = buildPurchaseSummary({
        items: cartItems.map((item) => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        total,
        customerName: form.name,
        customerEmail: form.email,
        documentType: form.documentType,
        documentNumber: form.documentNumber,
        address: form.address,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        phone: form.phone,
      });

      dispatch(setStatus({ type: 'success', message: `Pago aprobado. Referencia ${paymentData.transaction.reference}.` }));
      dispatch(setConfirmation(paymentConfirmation));
      setFinalOrderSummary(purchasedSummary);
      navigateToStep(5);
      dispatch(clearCart());
    } catch (error) {
      dispatch({
        type: 'checkout/setStatus',
        payload: {
          type: 'error',
          message: error instanceof Error ? error.message : 'No se pudo completar la compra.',
        },
      });
    } finally {
      dispatch(setSubmitting(false));
    }
  };

  const purchasedItemsForOrder = cartItems.map((item) => ({
    productId: item.id,
    name: item.name,
    quantity: item.quantity,
    price: item.price,
  }));

  const orderSummary = buildPurchaseSummary({
    items: purchasedItemsForOrder,
    total,
    customerName: form.name,
    customerEmail: form.email,
    documentType: form.documentType,
    documentNumber: form.documentNumber,
    address: form.address,
    city: form.city,
    state: form.state,
    postalCode: form.postalCode,
    phone: form.phone,
  });

  const summaryToDisplay = finalOrderSummary ?? orderSummary;

  useEffect(() => {
    if (hasNavigated) {
      stepHeadingRef.current?.focus({ preventScroll: true });
    }
  }, [currentStep, hasNavigated]);

  const renderConfirmationCard = (confirmationData = confirmation ?? buildPaymentConfirmation({
    reference: 'Sin referencia',
    amount: total,
    customerName: form.name,
    customerEmail: form.email,
  })) => (
    <div className="confirmation-card">
      <h4>Confirmación de compra</h4>
      <div className="confirmation-status success">
        <strong>Pago aprobado</strong>
        <span>Referencia: {confirmationData.reference}</span>
      </div>

      <p>
        <strong>Cliente:</strong> {confirmationData.customerName}
      </p>
      <p>
        <strong>Email:</strong> {confirmationData.customerEmail}
      </p>
      <p>
        <strong>Monto:</strong> {currencyFormatter.format(confirmationData.amount)}
      </p>
    </div>
  );

  const renderOrderSummaryCard = (summary = summaryToDisplay) => (
    <div className="confirmation-card">
      <h4>Resumen de la compra</h4>

      <section>
        <h5>Productos</h5>
        <ul className="confirmation-list">
          {summary.items.map((item) => (
            <li key={item.productId}>
              <span>
                {item.name} x{item.quantity}
              </span>
              <strong>{currencyFormatter.format(item.price * item.quantity)}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h5>Cliente</h5>
        <p>
          <strong>Nombre:</strong> {summary.customerName}
        </p>
        <p>
          <strong>Email:</strong> {summary.customerEmail}
        </p>
        <p>
          <strong>Documento:</strong> {summary.documentType} {summary.documentNumber}
        </p>
      </section>

      <section>
        <h5>Entrega</h5>
        <p>
          <strong>Dirección:</strong> {summary.address}
        </p>
        <p>
          <strong>Ciudad:</strong> {summary.city} · {summary.state}
        </p>
        <p>
          <strong>Código postal:</strong> {summary.postalCode}
        </p>
        <p>
          <strong>Teléfono:</strong> {summary.phone}
        </p>
      </section>

      <p className="confirmation-total">
        <strong>Total pagado:</strong> {currencyFormatter.format(summary.total)}
      </p>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="step-panel">
            <div className="products-grid">
              {products.map((product) => {
                const inCart = cart[product.id] ?? 0;
                return (
                  <article key={product.id} className="product-card">
                    <img src={product.imageUrl} alt={product.name} />
                    <div className="product-info">
                      <div className="product-head">
                        <h2>{product.name}</h2>
                        <span>{currencyFormatter.format(product.price)}</span>
                      </div>
                      <p>{product.description}</p>
                      <div className="product-meta">
                        <span>Stock: {product.stock}</span>
                        <button type="button" onClick={() => dispatch(addToCart(product))}>
                          {inCart > 0 ? `Agregar otro (${inCart})` : 'Agregar'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="step-panel form-step">
            <div className="field-grid two-columns">
              <label>
                Nombre
                <input value={form.name} onChange={(event) => handleFieldChange('name', event.target.value)} />
              </label>
              <label>
                Email
                <input type="email" value={form.email} onChange={(event) => handleFieldChange('email', event.target.value)} />
              </label>
            </div>
            <div className="field-grid two-columns">
              <label>
                Tipo documento
                <input value={form.documentType} onChange={(event) => handleFieldChange('documentType', event.target.value)} />
              </label>
              <label>
                Documento
                <input value={form.documentNumber} onChange={(event) => handleFieldChange('documentNumber', event.target.value)} />
              </label>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="step-panel form-step">
            <label>
              Dirección
              <input value={form.address} onChange={(event) => handleFieldChange('address', event.target.value)} />
            </label>
            <div className="field-grid two-columns">
              <label>
                Ciudad
                <input value={form.city} onChange={(event) => handleFieldChange('city', event.target.value)} />
              </label>
              <label>
                Departamento
                <input value={form.state} onChange={(event) => handleFieldChange('state', event.target.value)} />
              </label>
            </div>
            <div className="field-grid two-columns">
              <label>
                Código postal
                <input value={form.postalCode} onChange={(event) => handleFieldChange('postalCode', event.target.value)} />
              </label>
              <label>
                Teléfono
                <input value={form.phone} onChange={(event) => handleFieldChange('phone', event.target.value)} />
              </label>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="step-panel form-step">
            <label>
              Número de tarjeta
              <input value={form.cardNumber} onChange={(event) => handleFieldChange('cardNumber', event.target.value)} />
            </label>
            <label>
              Nombre del titular
              <input value={form.holderName} onChange={(event) => handleFieldChange('holderName', event.target.value)} />
            </label>
            <div className="field-grid three-columns">
              <label>
                Mes
                <input value={form.expMonth} onChange={(event) => handleFieldChange('expMonth', event.target.value)} />
              </label>
              <label>
                Año
                <input value={form.expYear} onChange={(event) => handleFieldChange('expYear', event.target.value)} />
              </label>
              <label>
                CVV
                <input value={form.cvv} onChange={(event) => handleFieldChange('cvv', event.target.value)} />
              </label>
            </div>
          </div>
        );
      case 5:
        return <div className="step-panel confirmation-panel">{renderConfirmationCard()}</div>;
      default:
        return null;
    }
  };

  return (
    <main className="checkout-shell">
      <section className="shop-panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Wompi</p>
            <h1>Checkout digital</h1>
          </div>
          <span className="pill">Pago seguro</span>
        </div>

        <div className="stepper" aria-label="Checkout progress">
          {stepLabels.map((label, index) => {
            const stepNumber = index + 1;
            const isUnlocked = isCheckoutStepUnlocked(stepNumber, form, effectiveCartCount);

            return (
              <button
                key={label}
                type="button"
                className={`step-pill ${stepNumber === currentStep ? 'active' : ''}`}
                disabled={!isUnlocked}
                onClick={() => {
                  if (isUnlocked) {
                    navigateToStep(stepNumber);
                  }
                }}
              >
                {stepNumber}. {label}
              </button>
            );
          })}
        </div>

        <section
          key={currentStep}
          className={`step-screen${hasNavigated ? ` step-screen-enter step-screen-${transitionDirection}` : ''}`}
          aria-labelledby="current-step-heading"
        >
          <h2 id="current-step-heading" ref={stepHeadingRef} className="sr-only" tabIndex={-1}>
            Paso {currentStep}: {stepLabels[currentStep - 1]}
          </h2>
          {renderStepContent()}
        </section>

        <div className="step-actions">
          {currentStep > 1 && (
            <button type="button" className="secondary-button" onClick={() => navigateToStep(currentStep - 1)}>
              Atrás
            </button>
          )}

          {currentStep < 5 ? (
            <button type="button" className="primary-button" onClick={goToNextStep}>
              Continuar
            </button>
          ) : confirmation ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setFinalOrderSummary(null);
                dispatch(resetCheckout());
                dispatch(clearConfirmation());
                setHasNavigated(true);
              }}
            >
              Nueva compra
            </button>
          ) : (
            <button type="button" className="primary-button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Procesando...' : `Pagar ${currencyFormatter.format(total)}`}
            </button>
          )}
        </div>
      </section>

      <aside className="summary-panel">
        <h3>{currentStep === 5 && confirmation ? 'Resumen final' : 'Resumen'}</h3>

        {currentStep === 5 && confirmation ? (
          renderOrderSummaryCard()
        ) : effectiveCartCount === 0 ? (
          <p className="empty-state">Tu carrito está vacío.</p>
        ) : (
          <>
            <div className="cart-list">
              {cartItems.map((item) => (
                <div key={item.id} className="cart-item">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{currencyFormatter.format(item.price)} c/u</span>
                  </div>
                  <div className="qty-controls">
                    <button type="button" onClick={() => dispatch(updateQuantity({ productId: item.id, quantity: item.quantity - 1 }))}>
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => dispatch(updateQuantity({ productId: item.id, quantity: item.quantity + 1 }))}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="totals">
              <div>
                <span>Subtotal</span>
                <strong>{currencyFormatter.format(subtotal)}</strong>
              </div>
              <div>
                <span>Envío</span>
                <strong>{currencyFormatter.format(shippingFee)}</strong>
              </div>
              <div>
                <span>Procesamiento</span>
                <strong>{currencyFormatter.format(handlingFee)}</strong>
              </div>
              <div className="grand-total">
                <span>Total</span>
                <strong>{currencyFormatter.format(total)}</strong>
              </div>
            </div>
          </>
        )}

        {status.message && <p className={`status-message ${status.type}`}>{status.message}</p>}
      </aside>
    </main>
  );
}

export default App;
