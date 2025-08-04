<script>
    // You can add any interactivity here if needed in the future
</script>

<style>
.overlay-card {
    position: fixed;
    bottom: 16px;
    right: 16px;
    width: 300px;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    padding: 16px;
    display: flex;
    align-items: center;
    font-family: Arial, sans-serif;
}

.card-image {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    margin-right: 12px;
}

.card-text {
    font-size: 14px;
    line-height: 1.5;
}

</style>

<div class="overlay-card">
    <img
        src="/luke.jpg"
        alt="Developer"
        class="card-image"
    />
    <div class="card-text">
        <h4>Luke Roy</h4>
        <p>Created the Foto Box. Slack me for more info.</p>
    </div>
</div>
