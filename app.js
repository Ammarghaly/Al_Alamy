import { db, ref, onValue } from './firebase.js';

// --- State Management ---
let cart = JSON.parse(localStorage.getItem('alamy_cart')) || [];
let activeItem = null; // For modal selection
export let menuData = null; // Expose globally if needed

// --- DOM elements ---
const accordionContainer = document.getElementById('menuAccordion');
const searchInput = document.getElementById('menuSearch');
const cartCount = document.getElementById('cartCount');
const cartDrawer = document.getElementById('cartDrawer');
const cartItemsContainer = document.getElementById('cartItems');
const cartTotalLabel = document.getElementById('cartTotal');
const modifierModal = document.getElementById('modifierModal');
const loader = document.getElementById('loader');
const globalOverlay = document.getElementById('globalOverlay');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Fetch data from Firebase Realtime Database
    const menuRef = ref(db, 'Al_Alamy');
    
    onValue(menuRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            menuData = data;
            
            // Update Hero section text/images dynamically
            document.querySelector('.restaurant-name').textContent = menuData.restaurantName;
            const logoEl = document.querySelector('.restaurant-logo');
            if (logoEl) logoEl.src = menuData.logo;
            
            // Initial Render
            renderMenu();
            updateCartUI();
            
            // Hide Loader
            setTimeout(() => {
                loader.style.opacity = '0';
                setTimeout(() => loader.style.display = 'none', 500);
            }, 500);
        } else {
            console.error("No data found in Firebase for Al_Alamy.");
        }
    }, (error) => {
        console.error("Firebase Read Error:", error);
    });
});

// --- UI Toggle Helpers ---
function showUI(element) {
    element.classList.add('active');
    globalOverlay.classList.add('active');
}

function hideAllUI() {
    cartDrawer.classList.remove('active');
    modifierModal.classList.remove('active');
    checkoutModal.classList.remove('active');
    globalOverlay.classList.remove('active');
}

globalOverlay.onclick = hideAllUI;

// --- Core Rendering ---
function renderMenu(filter = '') {
    accordionContainer.innerHTML = '';
    
    menuData.categories.forEach(category => {
        const filteredItems = category.items.filter(item => 
            item.name.toLowerCase().includes(filter.toLowerCase())
        );

        if (filteredItems.length === 0) return;

        const tile = document.createElement('div');
        tile.className = 'category-tile';
        tile.innerHTML = `
            <div class="category-header" onclick="document.querySelectorAll('.category-tile').forEach(t => t !== this.parentElement && t.classList.remove('active')); this.parentElement.classList.toggle('active')">
                <img src="${category.image}" alt="${category.name}" class="category-image" onerror="this.src='https://via.placeholder.com/60?text=Food'">
                <h3 class="category-name">${category.name}</h3>
                <i class="fas fa-chevron-down chevron"></i>
            </div>
            <div class="category-content">
                <div class="items-grid">
                    ${filteredItems.map(item => renderItemCard(item, category.id)).join('')}
                </div>
            </div>
        `;
        accordionContainer.appendChild(tile);
    });

    attachButtonListeners();
}

function renderItemCard(item, categoryId) {
    const hasMultiplePrices = item.prices ? true : false;
    const priceDisplay = hasMultiplePrices 
        ? `${Math.min(...Object.values(item.prices))} - ${Math.max(...Object.values(item.prices))} ج.م` 
        : `${item.price} ج.م`;

    return `
        <div class="item-card">
            <div class="item-info">
                <h4>${item.name}</h4>
                <p class="item-price">${priceDisplay}</p>
            </div>
            <button class="add-btn" data-item="${encodeURIComponent(JSON.stringify(item))}" data-cat="${categoryId}">
                <i class="fas fa-plus"></i>
            </button>
        </div>
    `;
}

function attachButtonListeners() {
    document.querySelectorAll('.add-btn').forEach(btn => {
        btn.onclick = (e) => {
            const item = JSON.parse(decodeURIComponent(btn.dataset.item));
            openModifierModal(item);
        };
    });
}

searchInput.addEventListener('input', (e) => {
    renderMenu(e.target.value);
});

// --- Modal Logic ---
function openModifierModal(item) {
    activeItem = { ...item, quantity: 1, selectedExtras: [] };
    
    const title = document.getElementById('modalTitle');
    const priceOptions = document.getElementById('priceOptions');
    const extrasContainer = document.getElementById('globalExtras');
    
    title.innerText = item.name;
    priceOptions.innerHTML = '';
    extrasContainer.innerHTML = '';

    if (item.prices) {
        priceOptions.innerHTML = '<label>اختر الحجم / النوع</label>';
        Object.entries(item.prices).forEach(([key, price], index) => {
            const div = document.createElement('div');
            div.className = `extra-item ${index === 0 ? 'selected' : ''}`;
            const sizeLabel = key === 'small' ? 'صغير' : key === 'large' ? 'كبير' : key === 'regular' ? 'عادي' : 'خاص';
            div.innerHTML = `<span>${sizeLabel}</span> <strong>${price} ج.م</strong>`;
            div.onclick = () => {
                document.querySelectorAll('#priceOptions .extra-item').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                activeItem.selectedPrice = price;
                activeItem.selectedSizeName = sizeLabel;
            };
            priceOptions.appendChild(div);
            if (index === 0) {
                activeItem.selectedPrice = price;
                activeItem.selectedSizeName = sizeLabel;
            }
        });
    } else {
        activeItem.selectedPrice = item.price;
    }

    menuData.globalExtras.forEach(extra => {
        const div = document.createElement('div');
        div.className = 'extra-item';
        div.innerHTML = `<span>${extra.name}</span> <strong>+${extra.price} ج.م</strong>`;
        div.onclick = () => {
            div.classList.toggle('selected');
            const exists = activeItem.selectedExtras.find(e => e.name === extra.name);
            if (exists) {
                activeItem.selectedExtras = activeItem.selectedExtras.filter(e => e.name !== extra.name);
            } else {
                activeItem.selectedExtras.push(extra);
            }
        };
        extrasContainer.appendChild(div);
    });

    showUI(modifierModal);
}

document.querySelector('.close-modal-btn').onclick = hideAllUI;

document.getElementById('addToCartBtn').onclick = () => {
    const finalItem = {
        id: Date.now(),
        name: activeItem.name,
        size: activeItem.selectedSizeName || null,
        price: activeItem.selectedPrice,
        extras: [...activeItem.selectedExtras],
        quantity: 1
    };
    
    cart.push(finalItem);
    saveCart();
    updateCartUI();
    hideAllUI();
    showToast('تمت الإضافة للسلة');
};

// --- Cart logic ---
function saveCart() {
    localStorage.setItem('alamy_cart', JSON.stringify(cart));
}

function updateCartUI() {
    cartCount.innerText = cart.length;
    cartItemsContainer.innerHTML = '';
    
    let total = 0;
    cart.forEach(item => {
        const itemTotal = (item.price + item.extras.reduce((sum, e) => sum + e.price, 0)) * item.quantity;
        total += itemTotal;

        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = `
            <div class="cart-item-main">
                <div class="cart-item-info">
                    <h4>${item.name} ${item.size ? `(${item.size})` : ''}</h4>
                    <small>${item.extras.map(e => e.name).join(', ')}</small>
                    <div class="cart-item-controls">
                        <button onclick="changeQuantity(${item.id}, -1)" class="qty-btn"><i class="fas fa-minus"></i></button>
                        <span class="qty-val">${item.quantity}</span>
                        <button onclick="changeQuantity(${item.id}, 1)" class="qty-btn"><i class="fas fa-plus"></i></button>
                        <button onclick="openEditModal(${item.id})" class="edit-btn" title="تعديل الإضافات"><i class="fas fa-magic"></i></button>
                    </div>
                </div>
                <div class="cart-item-price-group">
                    <p class="item-price-sum">${itemTotal} ج.م</p>
                    <button onclick="removeItem(${item.id})" class="btn-remove" aria-label="Remove item">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        cartItemsContainer.appendChild(el);
    });

    cartTotalLabel.innerText = `${total.toFixed(2)} ج.م`;
}

window.changeQuantity = (id, delta) => {
    const item = cart.find(x => x.id === id);
    if (!item) return;
    
    item.quantity += delta;
    if (item.quantity < 1) {
        removeItem(id);
    } else {
        saveCart();
        updateCartUI();
    }
};

window.openEditModal = (id) => {
    const itemInCart = cart.find(x => x.id === id);
    if (!itemInCart) return;
    
    // Find original item data to populate options
    let originalItem = null;
    menuData.categories.forEach(cat => {
        const found = cat.items.find(i => i.name === itemInCart.name);
        if (found) originalItem = found;
    });

    if (!originalItem) return;

    activeItem = { ...originalItem, quantity: itemInCart.quantity, selectedExtras: [...itemInCart.extras], editingId: id };
    
    const title = document.getElementById('modalTitle');
    const priceOptions = document.getElementById('priceOptions');
    const extrasContainer = document.getElementById('globalExtras');
    
    title.innerText = `تعديل: ${originalItem.name}`;
    priceOptions.innerHTML = '';
    extrasContainer.innerHTML = '';

    if (originalItem.prices) {
        priceOptions.innerHTML = '<label>اختر الحجم / النوع</label>';
        Object.entries(originalItem.prices).forEach(([key, price], index) => {
            const sizeLabel = key === 'small' ? 'صغير' : key === 'large' ? 'كبير' : key === 'regular' ? 'عادي' : 'خاص';
            const div = document.createElement('div');
            div.className = `extra-item ${itemInCart.size === sizeLabel ? 'selected' : ''}`;
            div.innerHTML = `<span>${sizeLabel}</span> <strong>${price} ج.م</strong>`;
            div.onclick = () => {
                document.querySelectorAll('#priceOptions .extra-item').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                activeItem.selectedPrice = price;
                activeItem.selectedSizeName = sizeLabel;
            };
            priceOptions.appendChild(div);
            if (itemInCart.size === sizeLabel) {
                activeItem.selectedPrice = price;
                activeItem.selectedSizeName = sizeLabel;
            }
        });
    } else {
        activeItem.selectedPrice = originalItem.price;
    }

    menuData.globalExtras.forEach(extra => {
        const div = document.createElement('div');
        const isSelected = itemInCart.extras.some(e => e.name === extra.name);
        div.className = `extra-item ${isSelected ? 'selected' : ''}`;
        div.innerHTML = `<span>${extra.name}</span> <strong>+${extra.price} ج.م</strong>`;
        div.onclick = () => {
            div.classList.toggle('selected');
            const exists = activeItem.selectedExtras.find(e => e.name === extra.name);
            if (exists) {
                activeItem.selectedExtras = activeItem.selectedExtras.filter(e => e.name !== extra.name);
            } else {
                activeItem.selectedExtras.push(extra);
            }
        };
        extrasContainer.appendChild(div);
    });

    document.getElementById('addToCartBtn').innerText = "تحديث الطلب";
    showUI(modifierModal);
};

window.removeItem = (id) => {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    updateCartUI();
};

document.getElementById('cartToggle').onclick = () => showUI(cartDrawer);
document.querySelector('.close-drawer-btn').onclick = hideAllUI;

document.getElementById('addToCartBtn').onclick = () => {
    const finalItem = {
        id: activeItem.editingId || Date.now(),
        name: activeItem.name,
        size: activeItem.selectedSizeName || null,
        price: activeItem.selectedPrice,
        extras: [...activeItem.selectedExtras],
        quantity: activeItem.quantity || 1
    };
    
    if (activeItem.editingId) {
        const idx = cart.findIndex(x => x.id === activeItem.editingId);
        cart[idx] = finalItem;
    } else {
        cart.push(finalItem);
    }
    
    saveCart();
    updateCartUI();
    hideAllUI();
    showToast(activeItem.editingId ? 'تم تحديث الطلب' : 'تمت الإضافة للسلة');
    
    // Reset modal button text
    document.getElementById('addToCartBtn').innerText = "إضافة للسلة";
};

// --- Checkout Workflow ---
const checkoutModal = document.getElementById('checkoutModal');
const closeCheckoutBtn = document.querySelector('.close-checkout-modal-btn');
const finalConfirmBtn = document.getElementById('finalConfirmBtn');

document.getElementById('checkoutBtn').onclick = () => {
    if (cart.length === 0) return alert('السلة فارغة!');
    hideAllUI();
    setTimeout(() => showUI(checkoutModal), 300);
};

closeCheckoutBtn.onclick = hideAllUI;

finalConfirmBtn.onclick = () => {
    const name = document.getElementById('custName').value.trim();
    const address = document.getElementById('custAddress').value.trim();
    const notes = document.getElementById('custNotes').value.trim();

    if (!name || !address) {
        return alert('يرجى إدخال الاسم والعنوان بالكامل');
    }

    let message = `*مطعم العالمي - طلب جديد* 🔔\n`;
    message += `==========================\n`;
    message += `👤 *العميل:* ${name}\n`;
    message += `📍 *العنوان:* ${address}\n`;
    if (notes) message += `📝 *ملاحظات:* ${notes}\n`;
    message += `==========================\n\n`;

    let total = 0;
    cart.forEach((item, index) => {
        const itemTotal = (item.price + item.extras.reduce((sum, e) => sum + e.price, 0)) * item.quantity;
        total += itemTotal;
        message += `*${index + 1}- ${item.quantity} x ${item.name}* ${item.size ? `(${item.size})` : ''}\n`;
        if (item.extras.length > 0) {
            item.extras.forEach(e => {
                message += `   └─ + ${e.name}\n`;
            });
        }
        message += `   💰 *السعر:* ${itemTotal} ج.م\n\n`;
    });

    message += `==========================\n`;
    message += `💵 *الإجمالي النهائي: ${total} ج.م*\n`;
    message += `==========================\n`;
    message += `\n*شكراً لاختياركم مطعم العالمي!* ✨`;

    const whatsappUrl = `https://wa.me/${menuData.phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    
    cart = [];
    saveCart();
    updateCartUI();
    hideAllUI();
};

// --- Utilities ---
function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
        background: var(--dark); color: white; padding: 10px 20px; border-radius: 50px;
        z-index: 9999; animation: slideUp 0.3s ease;
    `;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}
