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

interface IProductQuantity {
  [key: string]: number;
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

    const productQuantity: IProductQuantity = {};
    products.forEach(function (item) {
      productQuantity[item.id] = item.quantity;
    });

    const findProducts = await this.productsRepository.findAllById(products);

    if (findProducts.length === 0 || findProducts.length !== products.length) {
      throw new AppError('Product not found');
    }

    const formattedProducts = findProducts.map(item => {
      if (productQuantity[item.id] > item.quantity) {
        throw new AppError('Out of stock');
      }

      return {
        ...item,
        product_id: item.id,
        quantity: productQuantity[item.id],
        quantity_update: item.quantity - productQuantity[item.id],
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: formattedProducts,
    });

    const productsToUpdate = findProducts.map(item => {
      return {
        ...item,
        quantity: item.quantity - productQuantity[item.id],
      };
    });

    await this.productsRepository.updateQuantity(productsToUpdate);

    return order;
  }
}

export default CreateOrderService;
