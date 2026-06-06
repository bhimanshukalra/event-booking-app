ALTER TABLE "reservation_items"
ADD CONSTRAINT "reservation_items_quantity_positive_check"
CHECK ("quantity" > 0);

