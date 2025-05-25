const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { authMiddleware } = require("../middleware/authMiddleware");

// Get user's cart
router.get("/", authMiddleware, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product"
    );

    if (cart) {
      // Remove invalid products (deleted from DB)
      const validItems = cart.items.filter((item) => item.product !== null);
      if (validItems.length !== cart.items.length) {
        cart.items = validItems;
        await cart.save();
      }
      return res.json(cart);
    }

    // Return empty cart if none found
    res.json({ user: req.user._id, items: [] });
  } catch (err) {
    res.status(500).json({ message: "Error fetching cart" });
  }
});

// Add item to cart or update quantity
router.post("/add", authMiddleware, async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  try {
    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();
    // Populate items.product without execPopulate (deprecated)
    cart = await Cart.findOne({ user: req.user._id }).populate("items.product");

    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: "Error updating cart" });
  }
});

// Update quantity
router.put("/update", authMiddleware, async (req, res) => {
  const { productId, quantity } = req.body;

  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.find((i) => i.product.toString() === productId);
    if (!item) return res.status(404).json({ message: "Item not in cart" });

    item.quantity = quantity;
    // Remove items with quantity <= 0
    cart.items = cart.items.filter((i) => i.quantity > 0);

    await cart.save();

    const populatedCart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product"
    );
    res.json(populatedCart);
  } catch (err) {
    res.status(500).json({ message: "Error updating quantity" });
  }
});

// Remove item from cart
router.delete("/remove/:productId", authMiddleware, async (req, res) => {
  const { productId } = req.params;

  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    );

    await cart.save();

    const populatedCart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product"
    );
    res.json(populatedCart);
  } catch (err) {
    res.status(500).json({ message: "Error removing item" });
  }
});

router.post("/checkout", authMiddleware, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product"
    );

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Check stock availability for each item
    for (const item of cart.items) {
      if (!item.product) {
        return res.status(400).json({ message: "Product not found in cart" });
      }
      if (item.product.countInStock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for "${item.product.title}". Available: ${item.product.countInStock}, Requested: ${item.quantity}`,
        });
      }
    }

    // Deduct stock for each product
    for (const item of cart.items) {
      item.product.countInStock -= item.quantity;
      if (item.product.countInStock < 0) item.product.countInStock = 0;
      await item.product.save();
    }

    // Clear cart after successful order
    cart.items = [];
    await cart.save();

    res.json({ message: "Order placed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Checkout failed" });
  }
});

module.exports = router;
