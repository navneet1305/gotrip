// booking.js - Handles the booking form functionality

document.addEventListener('DOMContentLoaded', function() {
    // Load destinations when the page loads
    loadDestinations();

    // Set up event listeners for the booking form
    setupBookingForm();

    // Load destination information section
    loadDestinationInfo();
});

// Function to load destinations into the select dropdown
function loadDestinations() {
    const selectElement = document.getElementById('destination');
    if (!selectElement) return;

    const defaultDestinations = [
        { id: 1, name: "Bern", country: "Switzerland" },
        { id: 2, name: "Paris", country: "France" },
        { id: 3, name: "Tokyo", country: "Japan" },
        { id: 4, name: "Vancouver", country: "Canada" },
        { id: 5, name: "Seoul", country: "South Korea" },
        { id: 6, name: "Monaco", country: "Monaco" }
    ];

    function populateOptions(destinations) {
        selectElement.innerHTML = '<option value="">Select a destination</option>';
        destinations.forEach(dest => {
            const option = document.createElement('option');
            option.value = `${dest.id}|${dest.name}, ${dest.country}`;
            option.textContent = `${dest.name}, ${dest.country}`;
            selectElement.appendChild(option);
        });

        // If URL parameters are present, pre-select the destination
        const urlParams = new URLSearchParams(window.location.search);
        const destParam = urlParams.get('destination');
        const dateParam = urlParams.get('date');

        if (destParam) {
            const options = Array.from(selectElement.options);
            const matchingOption = options.find(option => 
                option.textContent.toLowerCase().includes(destParam.toLowerCase())
            );
            if (matchingOption) {
                matchingOption.selected = true;
                updatePrice();
            }
        }

        if (dateParam) {
            const checkInInput = document.getElementById('check_in_date');
            if (checkInInput) checkInInput.value = dateParam;
        }
    }

    // Try multiple possible paths for destinations.json
    const jsonPath = window.location.pathname.includes('/views/') ? '../destinations.json' : './destinations.json';
    fetch(jsonPath)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(destinations => {
            populateOptions(destinations);
        })
        .catch(err => {
            console.log('Using default destinations list:', err.message);
            populateOptions(defaultDestinations);
        });
}


// Function to set up the booking form
function setupBookingForm() {
    const form = document.getElementById('bookingForm');
    const destinationSelect = document.getElementById('destination');
    const numTravelersInput = document.getElementById('num_travelers');
    const checkInDateInput = document.getElementById('check_in_date');
    const checkOutDateInput = document.getElementById('check_out_date');
    const priceDisplay = document.getElementById('price_display');
    
    // Calculate initial price
    updatePrice();
    
    // Update price when inputs change
    destinationSelect.addEventListener('change', updatePrice);
    numTravelersInput.addEventListener('change', updatePrice);
    checkInDateInput.addEventListener('change', updatePrice);
    checkOutDateInput.addEventListener('change', updatePrice);
    
    // Handle form submission
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        
        const formData = new FormData(form);
        // Log the form data for debugging
        console.log('Submitting booking with data:');
        for (let [key, value] of formData.entries()) {
            console.log(key + ': ' + value);
        }
        
        fetch('process_booking.php', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                alert('Booking successful! Your booking reference is: ' + data.booking_id);
                            window.location.href = '../my_bookings.php';
            } else {
                alert('Error: ' + data.message);
                console.error('Booking error:', data);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while processing your booking. Please try again.');
        });
    });
}

// Function to update the price based on destination and number of travelers
function updatePrice() {
    const destinationValue = document.getElementById('destination').value;
    const numTravelers = parseInt(document.getElementById('num_travelers').value);
    const checkInDate = document.getElementById('check_in_date').value;
    const priceDisplay = document.getElementById('price_display');
    
    // Skip if no destination selected
    if (!destinationValue) {
        priceDisplay.textContent = '₹0';
        return;
    }
    
    // Get destination ID if available in the format "id|name, country"
    let destinationId = null;
    if (destinationValue.includes('|')) {
        destinationId = destinationValue.split('|')[0];
    }
    
    const destination = destinationValue.includes('|') 
        ? destinationValue.split('|')[1] 
        : destinationValue;
    
    // First try to get dynamic pricing if we have the ID
    if (destinationId) {
        const priceEndpoint = window.location.pathname.includes('/views/') ? '../get_prices.php' : 'get_prices.php';
        fetch(`${priceEndpoint}?id=${destinationId}`)
            .then(response => {
                if (!response.ok) throw new Error('Price endpoint response was not ok');
                return response.json();
            })
            .then(prices => {
                if (prices && prices.length > 0) {
                    const priceInfo = prices[0];
                    calculateTotalPrice(priceInfo.dynamic_price, numTravelers, priceDisplay, priceInfo.factors);
                } else {
                    fallbackPriceCalculation(destination, numTravelers, priceDisplay);
                }
            })
            .catch(error => {
                console.warn('Dynamic price unavailable, using fallback:', error.message);
                fallbackPriceCalculation(destination, numTravelers, priceDisplay);
            });
    } else {
        fallbackPriceCalculation(destination, numTravelers, priceDisplay);
    }
}

// Helper function to calculate the final price with all factors
function calculateTotalPrice(basePrice, numTravelers, priceDisplay, factors = null) {
    // Calculate early booking or last-minute discount if check-in date is available
    const checkInDate = document.getElementById('check_in_date').value;
    let dateFactor = 1.0;
    
    if (checkInDate) {
        const today = new Date();
        const bookingDate = new Date(checkInDate);
        const daysDifference = Math.floor((bookingDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysDifference >= 30) {
            // Early bird discount (5% off) for bookings 30+ days in advance
            dateFactor = 0.95;
        } else if (daysDifference <= 7 && daysDifference >= 0) {
            // Last-minute discount (10% off) for bookings within 7 days
            dateFactor = 0.9;
        }
    }
    
    // Apply number of travelers discount
    let groupFactor = 1.0;
    if (numTravelers >= 5) {
        groupFactor = 0.95; // 5% group discount for 5+ travelers
    } else if (numTravelers >= 3) {
        groupFactor = 0.98; // 2% group discount for 3-4 travelers
    }
    
    // Calculate total price with all factors
    const totalPrice = basePrice * numTravelers * dateFactor * groupFactor;
    
    // Format and display price with factor information
    const formattedPrice = '₹' + totalPrice.toLocaleString('en-IN');
    priceDisplay.textContent = formattedPrice;
    
    // Add tooltip with price factor information
    let tooltipText = '';
    if (factors) {
        tooltipText = `Factors: Season (${factors.season}), Demand (${factors.demand})${factors.special_event ? ', Special Event' : ''}`;
    }
    if (dateFactor !== 1.0) {
        tooltipText += dateFactor === 0.95 ? ', Early Bird Discount' : ', Last-Minute Discount';
    }
    if (groupFactor !== 1.0) {
        tooltipText += ', Group Discount';
    }
    
    if (tooltipText) {
        priceDisplay.setAttribute('data-tooltip', tooltipText);
        priceDisplay.classList.add('dynamic-price');
    }
}

// Fallback function to calculate price if dynamic pricing fails
function fallbackPriceCalculation(destination, numTravelers, priceDisplay) {
    let basePrice = 0;
    
    // Set base price based on destination
    if (destination.includes('London')) {
        basePrice = 150000; // ₹1,50,000
    } else if (destination.includes('Vancouver') || destination.includes('Canada')) {
        basePrice = 199999; // ₹1,99,999
    } else if (destination.includes('Monaco')) {
        basePrice = 139999; // ₹1,39,999
    } else if (destination.includes('Paris') || destination.includes('France')) {
        basePrice = 149999; // ₹1,49,999
    } else if (destination.includes('Tokyo') || destination.includes('Japan')) {
        basePrice = 169999; // ₹1,69,999
    } else if (destination.includes('Zurich') || destination.includes('Switzerland')) {
        basePrice = 159999; // ₹1,59,999
    } else if (destination.includes('Seoul') || destination.includes('Korea')) {
        basePrice = 149999; // ₹1,49,999
    } else {
        basePrice = 100000; // Default price: ₹1,00,000
    }
    
    // Use the helper function to calculate the total price
    calculateTotalPrice(basePrice, numTravelers, priceDisplay);
}

// Function to load destination information cards
function loadDestinationInfo() {
    const pricesUrl = window.location.pathname.includes('/views/') ? '../get_prices.php' : 'get_prices.php';
    fetch(pricesUrl)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(destinations => {
            const container = document.querySelector('.destinations-container');
            
            // If container doesn't exist, exit the function
            if (!container) return;
            
            container.innerHTML = ''; // Clear existing content
            
            // Take only the first 3 destinations to display
            const displayDestinations = destinations.slice(0, 3);
            
            displayDestinations.forEach(dest => {
                const card = document.createElement('div');
                card.className = 'destination-card';
                
                // Calculate price change percentage
                let priceChangeText = '';
                if (dest.base_price !== dest.dynamic_price) {
                    const percentChange = ((dest.dynamic_price - dest.base_price) / dest.base_price * 100).toFixed(1);
                    const changeClass = percentChange > 0 ? 'price-up' : 'price-down';
                    const arrow = percentChange > 0 ? '▲' : '▼';
                    priceChangeText = `<span class="price-indicator ${changeClass}">${arrow} ${Math.abs(percentChange)}%</span>`;
                }
                
                const factorTooltip = dest.factors ? `data-tooltip="Factors: Season (${dest.factors.season}), Demand (${dest.factors.demand})${dest.factors.special_event ? ', Special Event' : ''}"` : '';
                const displayPrice = dest.formatted_dynamic_price || ('₹' + (dest.dynamic_price || dest.base_price || 149999).toLocaleString('en-IN'));

                card.innerHTML = `
                    <h3>${dest.name}, ${dest.country}</h3>
                    <p>Experience the beauty and wonder of ${dest.name}</p>
                    <p class="destination-price dynamic-price" ${factorTooltip}>
                       ${displayPrice} ${priceChangeText}
                    </p>
                    <button class="select-btn" data-destination="${dest.id}|${dest.name}, ${dest.country}">Select</button>
                `;
                
                container.appendChild(card);
            });
            
            // Add event listeners to "Select" buttons
            document.querySelectorAll('.select-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const dest = this.getAttribute('data-destination');
                    const destInput = document.getElementById('destination');
                    if (destInput) destInput.value = dest;
                    updatePrice();
                    const checkInInput = document.getElementById('check_in_date');
                    if (checkInInput) checkInInput.focus();
                    
                    // Scroll up to the booking form
                    const bookingSec = document.querySelector('.booking-section');
                    if (bookingSec) bookingSec.scrollIntoView({ behavior: 'smooth' });
                });
            });
        })
        .catch(error => {
            console.warn('Error loading dynamic destinations, trying fallback:', error.message);
            loadDestinationFallback();
        });
}

// Fallback function to load destination information
function loadDestinationFallback() {
    const destUrl = window.location.pathname.includes('/views/') ? '../get_destinations.php' : 'get_destinations.php';
    fetch(destUrl)
        .then(response => {
            if (!response.ok) throw new Error('Fallback endpoint response was not ok');
            return response.json();
        })
        .then(destinations => {
            renderFallbackCards(destinations);
        })
        .catch(error => {
            console.warn('Error fetching destinations backend, using static destinations list:', error.message);
            const staticList = [
                { id: 1, name: "Bern", country: "Switzerland", price: "₹1,59,999" },
                { id: 2, name: "Paris", country: "France", price: "₹1,49,999" },
                { id: 3, name: "Tokyo", country: "Japan", price: "₹1,69,999" }
            ];
            renderFallbackCards(staticList);
        });
}

function renderFallbackCards(destinations) {
    const container = document.querySelector('.destinations-container');
    if (!container) return;
    
    container.innerHTML = '';
    const displayDestinations = (destinations || []).slice(0, 3);
    
    displayDestinations.forEach(dest => {
        const card = document.createElement('div');
        card.className = 'destination-card';
        const priceTag = dest.price ? `<p class="destination-price">${dest.price}</p>` : '';
        
        card.innerHTML = `
            <h3>${dest.name}, ${dest.country}</h3>
            <p>Experience the beauty and wonder of ${dest.name}</p>
            ${priceTag}
            <button class="select-btn" data-destination="${dest.id}|${dest.name}, ${dest.country}">Select</button>
        `;
        
        container.appendChild(card);
    });
    
    document.querySelectorAll('.select-btn').forEach(button => {
        button.addEventListener('click', function() {
            const dest = this.getAttribute('data-destination');
            const destInput = document.getElementById('destination');
            if (destInput) destInput.value = dest;
            updatePrice();
            const checkInInput = document.getElementById('check_in_date');
            if (checkInInput) checkInInput.focus();
        });
    });
} 
