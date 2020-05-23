import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found');
    }

    const findProducts = await this.productsRepository.findAllById(products);

    if (findProducts.length !== products.length) {
      throw new AppError('Invalid products');
    }

    const checkStock = products.filter(product => {
      const storedProduct = findProducts.find(
        findProduct => findProduct.id === product.id,
      );

      return (
        storedProduct &&
        storedProduct.id === product.id &&
        storedProduct.quantity - product.quantity < 0
      );
    });

    if (checkStock.length > 0) {
      throw new AppError('Some of ordered products are out of stock');
    }

    const productsInOrder = findProducts.map(product => {
      return {
        product_id: product.id,
        price:
          findProducts[findProducts.findIndex(item => item.id === product.id)]
            .price,
        quantity: product.quantity,
      };
    });

    const newOrder = await this.ordersRepository.create({
      customer,
      products: productsInOrder,
    });

    await this.productsRepository.updateQuantity(products);

    return newOrder;
  }
}

export default CreateOrderService;
