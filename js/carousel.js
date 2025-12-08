// ==========================================
// PHOTO CAROUSEL FUNCTIONALITY
// ==========================================

class PhotoCarousel {
    constructor() {
        this.track = document.querySelector('.carousel-track');
        this.slides = Array.from(document.querySelectorAll('.carousel-slide'));
        this.prevBtn = document.querySelector('.carousel-btn.prev');
        this.nextBtn = document.querySelector('.carousel-btn.next');
        this.indicators = Array.from(document.querySelectorAll('.carousel-indicator'));
        
        this.currentIndex = 0;
        this.autoplayInterval = null;
        
        this.init();
    }
    
    init() {
        // Set up event listeners
        this.prevBtn.addEventListener('click', () => this.prevSlide());
        this.nextBtn.addEventListener('click', () => this.nextSlide());
        
        this.indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => this.goToSlide(index));
        });
        
        // Add keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.prevSlide();
            if (e.key === 'ArrowRight') this.nextSlide();
        });
        
        // Touch/swipe support
        this.addTouchSupport();
        
        // Start autoplay
        this.startAutoplay();
        
        // Pause autoplay on hover
        const carouselContainer = document.querySelector('.carousel-container');
        carouselContainer.addEventListener('mouseenter', () => this.stopAutoplay());
        carouselContainer.addEventListener('mouseleave', () => this.startAutoplay());
    }
    
    goToSlide(index) {
        this.currentIndex = index;
        const offset = -100 * this.currentIndex;
        this.track.style.transform = `translateX(${offset}%)`;
        this.updateIndicators();
    }
    
    nextSlide() {
        this.currentIndex = (this.currentIndex + 1) % this.slides.length;
        this.goToSlide(this.currentIndex);
    }
    
    prevSlide() {
        this.currentIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
        this.goToSlide(this.currentIndex);
    }
    
    updateIndicators() {
        this.indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === this.currentIndex);
        });
    }
    
    startAutoplay() {
        this.autoplayInterval = setInterval(() => this.nextSlide(), 5000); // Change slide every 5 seconds
    }
    
    stopAutoplay() {
        if (this.autoplayInterval) {
            clearInterval(this.autoplayInterval);
            this.autoplayInterval = null;
        }
    }
    
    addTouchSupport() {
        let startX = 0;
        let currentX = 0;
        
        this.track.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            this.stopAutoplay();
        });
        
        this.track.addEventListener('touchmove', (e) => {
            currentX = e.touches[0].clientX;
        });
        
        this.track.addEventListener('touchend', () => {
            const diff = startX - currentX;
            if (Math.abs(diff) > 50) { // Minimum swipe distance
                if (diff > 0) {
                    this.nextSlide();
                } else {
                    this.prevSlide();
                }
            }
            this.startAutoplay();
        });
    }
}

// Initialize carousel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PhotoCarousel();
});
