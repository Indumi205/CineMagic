// ---------- MOVIE DATABASE ----------
const movies = [
    { id: 1, title: "Dune: Part Two", genre: "Sci-Fi", duration: "166 min", rating: "PG-13", price: 14.50, posterColor: "linear-gradient(145deg, #c49a6c, #6b3e1f)", imageBg: "url('https://placehold.co/600x400/1f2a3a/white?text=DUNE+2')" },
    { id: 2, title: "Kung Fu Panda 4", genre: "Animation", duration: "94 min", rating: "PG", price: 12.00, posterColor: "linear-gradient(145deg, #f5a623, #d97a1c)", imageBg: "url('https://placehold.co/600x400/2c3e2f/white?text=KUNG+FU')" },
    { id: 3, title: "Oppenheimer", genre: "Drama", duration: "180 min", rating: "R", price: 15.00, posterColor: "linear-gradient(145deg, #2c2c2c, #000000)", imageBg: "url('https://placehold.co/600x400/2d2f36/white?text=OPPENHEIMER')" },
    { id: 4, title: "The Fall Guy", genre: "Action", duration: "125 min", rating: "PG-13", price: 13.50, posterColor: "linear-gradient(145deg, #e05a5a, #a31f1f)", imageBg: "url('https://placehold.co/600x400/442222/white?text=FALL+GUY')" },
    { id: 5, title: "Ghostbusters: Frozen", genre: "Comedy", duration: "115 min", rating: "PG-13", price: 13.00, posterColor: "linear-gradient(145deg, #3f8db3, #145c7a)", imageBg: "url('https://placehold.co/600x400/2c5f6e/white?text=GHOSTBUSTERS')" },
    { id: 6, title: "Challengers", genre: "Drama/Sport", duration: "131 min", rating: "R", price: 14.00, posterColor: "linear-gradient(145deg, #9b6b9e, #5d3a5e)", imageBg: "url('https://placehold.co/600x400/4a2c4a/white?text=CHALLENGERS')" }
];

// seat layout for each movie: we will generate a matrix 6 rows x 8 cols (some seats blocked)
// For simplicity: each movie has own seat map: but for demo we create a seat map factory with random unavailable (some prebooked)
function generateSeatMap() {
    let seats = [];
    const rows = 6;
    const cols = 8;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const seatId = `${String.fromCharCode(65+r)}${c+1}`;
            // randomly pre-book 12% of seats to simulate sold
            let isBooked = false;
            const rand = Math.random() * 100;
            if (rand < 12) isBooked = true;
            seats.push({
                id: seatId,
                row: r,
                col: c,
                available: !isBooked,
            });
        }
    }
    return seats;
}

// Global state: each movie gets its own seat map copy from function
let movieSeats = {}; // key: movieId -> array of seat objects
// Cart items: array of { id, movieId, movieTitle, seats: [seatId], totalPrice, ticketQty }
let cart = [];

// helper to load or init seat map for movie
function getSeatsForMovie(movieId) {
    if (!movieSeats[movieId]) {
        movieSeats[movieId] = generateSeatMap();
    }
    return movieSeats[movieId];
}

// update seat map after booking (mark seats as unavailable)
function markSeatsAsTaken(movieId, seatIds) {
    const seats = getSeatsForMovie(movieId);
    seatIds.forEach(seatId => {
        const seatObj = seats.find(s => s.id === seatId);
        if (seatObj) seatObj.available = false;
    });
    // persist
    movieSeats[movieId] = seats;
}

// render movie cards
function renderMovies() {
    const grid = document.getElementById('movieGrid');
    grid.innerHTML = '';
    movies.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <div class="movie-poster" style="background: ${movie.posterColor}, ${movie.imageBg}; background-size: cover; background-blend-mode: overlay;">
                <div class="rating-badge"><i class="fas fa-star"></i> ${movie.rating}</div>
            </div>
            <div class="movie-info">
                <div class="movie-title">${movie.title}</div>
                <div class="movie-meta"><span><i class="fas fa-clock"></i> ${movie.duration}</span> <span><i class="fas fa-tag"></i> ${movie.genre}</span></div>
                <div class="movie-meta"><span><i class="fas fa-dollar-sign"></i> ${movie.price.toFixed(2)} / ticket</span></div>
                <button class="btn-book" data-id="${movie.id}"><i class="fas fa-chair"></i> Select Seats</button>
            </div>
        `;
        grid.appendChild(card);
    });
    document.querySelectorAll('.btn-book').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const movieId = parseInt(btn.getAttribute('data-id'));
            openBookingModal(movieId);
        });
    });
}

let currentMovieForModal = null;

function openBookingModal(movieId) {
    const movie = movies.find(m => m.id === movieId);
    if (!movie) return;
    currentMovieForModal = movie;
    const modal = document.getElementById('bookingModal');
    const modalTitle = document.getElementById('modalMovieTitle');
    modalTitle.innerText = `${movie.title} - Select Seats`;
    const modalBody = document.getElementById('modalBody');
    const seats = getSeatsForMovie(movie.id);
    
    // build seat grid UI
    let selectedSeats = []; // temporary for this session
    let seatElements = new Map();

    function renderSeatSelection() {
        const rowsGroup = {};
        seats.forEach(seat => {
            if (!rowsGroup[seat.row]) rowsGroup[seat.row] = [];
            rowsGroup[seat.row].push(seat);
        });
        let html = `<div class="legend"><span><i class="fas fa-square" style="color:#cbd5e1;"></i> Available</span>
        <span><i class="fas fa-square" style="color:#e50914;"></i> Selected</span>
        <span><i class="fas fa-square" style="color:#94a3b8;"></i> Sold</span></div>
        <div class="seat-grid" id="dynamicSeatGrid"></div>
        <div class="ticket-summary">
            <strong>Selected seats:</strong> <span id="selectedSeatsList">None</span><br>
            <strong>Ticket price each:</strong> $${movie.price.toFixed(2)}<br>
            <strong>Total:</strong> $<span id="tempTotal">0.00</span>
        </div>
        <button class="confirm-btn" id="finalBookingBtn">Add to Cart & Book</button>`;
        modalBody.innerHTML = html;
        const gridContainer = document.getElementById('dynamicSeatGrid');
        // render seats dynamically
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 8; c++) {
                const seat = seats.find(s => s.row === r && s.col === c);
                if (seat) {
                    const seatDiv = document.createElement('div');
                    seatDiv.className = 'seat';
                    if (!seat.available) seatDiv.classList.add('unavailable');
                    if (selectedSeats.includes(seat.id)) seatDiv.classList.add('selected');
                    if (seat.available && !selectedSeats.includes(seat.id)) seatDiv.classList.add('available');
                    seatDiv.innerText = seat.id;
                    seatDiv.dataset.seatId = seat.id;
                    if (seat.available) {
                        seatDiv.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (selectedSeats.includes(seat.id)) {
                                selectedSeats = selectedSeats.filter(s => s !== seat.id);
                            } else {
                                selectedSeats.push(seat.id);
                            }
                            renderSeatSelection(); // re-render fresh
                        });
                    }
                    gridContainer.appendChild(seatDiv);
                }
            }
        }
        const selectedSpan = document.getElementById('selectedSeatsList');
        selectedSpan.innerText = selectedSeats.length ? selectedSeats.join(', ') : 'None';
        const totalVal = selectedSeats.length * movie.price;
        document.getElementById('tempTotal').innerText = totalVal.toFixed(2);
        const finalBtn = document.getElementById('finalBookingBtn');
        finalBtn.onclick = () => {
            if (selectedSeats.length === 0) {
                alert('Please select at least one seat.');
                return;
            }
            // add to cart
            const existingCartIdx = cart.findIndex(item => item.movieId === movie.id && JSON.stringify(item.seats.sort()) === JSON.stringify(selectedSeats.sort()));
            if (existingCartIdx !== -1) {
                alert('These exact seats are already in your cart!');
                return;
            }
            // also check if any of selected seats are now unavailable due to race? but we check again
            const freshSeats = getSeatsForMovie(movie.id);
            const conflict = selectedSeats.some(seatId => {
                const seatObj = freshSeats.find(s => s.id === seatId);
                return !seatObj || !seatObj.available;
            });
            if (conflict) {
                alert('Sorry, some seats became unavailable. Please re-select.');
                // refresh seat map and close/reopen? simpler: re-render modal
                openBookingModal(movie.id);
                return;
            }
            // commit temporary: mark as taken in local seat map (but not persistent until checkout? For multi-cart we should reserve. To keep demo clean: mark as taken immediately after adding to cart)
            // BUT we have to allow cart cancellation? We'll implement removal from cart releases seats. So we mark taken after add but also allow revert on remove.
            markSeatsAsTaken(movie.id, selectedSeats);
            // add cart item
            const cartItem = {
                id: Date.now() + Math.random(),
                movieId: movie.id,
                movieTitle: movie.title,
                seats: [...selectedSeats],
                totalPrice: selectedSeats.length * movie.price,
                ticketQty: selectedSeats.length,
                pricePerTicket: movie.price
            };
            cart.push(cartItem);
            updateCartBadge();
            alert(`Added ${selectedSeats.length} ticket(s) for ${movie.title} (Seats: ${selectedSeats.join(', ')})`);
            closeModal();
            renderMovies(); // refresh no visual needed, but seat map updated for next bookings.
        };
    }
    renderSeatSelection();
    modal.style.display = 'flex';
}

function updateCartBadge() {
    const totalTickets = cart.reduce((sum, item) => sum + item.ticketQty, 0);
    document.getElementById('cartCountBadge').innerText = totalTickets;
}

function renderCartModal() {
    const cartBody = document.getElementById('cartBody');
    if (!cart.length) {
        cartBody.innerHTML = `<div class="empty-cart"><i class="fas fa-ticket-alt fa-2x"></i><p>No tickets booked yet.<br>Browse movies and select seats!</p></div>`;
        document.getElementById('cartTotalPrice').innerText = `Total: $0.00`;
        return;
    }
    let totalSum = 0;
    let itemsHtml = `<div class="cart-items-list">`;
    cart.forEach((item, idx) => {
        totalSum += item.totalPrice;
        itemsHtml += `
            <div class="cart-item">
                <div><strong>${item.movieTitle}</strong><br>
                <span style="font-size:0.8rem;">Seats: ${item.seats.join(', ')}</span><br>
                <span>${item.ticketQty} x $${item.pricePerTicket.toFixed(2)}</span>
                </div>
                <button class="remove-item-btn" data-idx="${idx}" style="background:#f1f5f9; border:none; border-radius:30px; padding:0 12px; color:#e50914;"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
    });
    itemsHtml += `</div>`;
    cartBody.innerHTML = itemsHtml;
    document.getElementById('cartTotalPrice').innerHTML = `Total: $${totalSum.toFixed(2)}`;
    document.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            if (!isNaN(idx) && cart[idx]) {
                const removed = cart[idx];
                // release seats back to availability
                const movieSeatMap = getSeatsForMovie(removed.movieId);
                removed.seats.forEach(seatId => {
                    const seat = movieSeatMap.find(s => s.id === seatId);
                    if (seat) seat.available = true;
                });
                cart.splice(idx, 1);
                updateCartBadge();
                renderCartModal();   // refresh cart view
                // also persist seat changes globally
            }
        });
    });
}

function openCartModal() {
    renderCartModal();
    document.getElementById('cartModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('bookingModal').style.display = 'none';
    document.getElementById('cartModal').style.display = 'none';
    currentMovieForModal = null;
}

// Checkout: confirm all tickets (finalize)
function checkout() {
    if (cart.length === 0) {
        alert('No tickets in cart.');
        return;
    }
    const totalTickets = cart.reduce((sum,i)=> sum + i.ticketQty,0);
    const totalPrice = cart.reduce((sum,i)=> sum + i.totalPrice,0);
    alert(`✅ Booking confirmed!\nTotal Tickets: ${totalTickets}\nTotal Paid: $${totalPrice.toFixed(2)}\n\nEnjoy your movie at CineMagic! 🍿`);
    cart = [];
    updateCartBadge();
    renderCartModal();
    closeModal();
    // reset all seat maps? No, but we keep them as taken because already taken upon adding to cart. That's correct.
    // we also need to reflect final state, but seats are already taken in memory. Perfect.
    renderMovies(); // refresh UI
}

// event listeners
document.getElementById('openCartBtn').addEventListener('click', openCartModal);
document.getElementById('closeModalBtn').addEventListener('click', closeModal);
document.getElementById('closeCartBtn').addEventListener('click', closeModal);
document.getElementById('checkoutBtn').addEventListener('click', checkout);
window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('bookingModal')) closeModal();
    if (e.target === document.getElementById('cartModal')) closeModal();
});

// init
function init() {
    renderMovies();
    updateCartBadge();
}
init();