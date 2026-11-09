import 'package:go_router/go_router.dart';

import '../features/references/presentation/home_screen.dart';
import '../features/shoot/presentation/review_screen.dart';
import '../features/shoot/presentation/shoot_screen.dart';

final appRouter = GoRouter(
  routes: [
    GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
    GoRoute(
      path: '/shoot/:id',
      builder: (context, state) =>
          ShootScreen(referenceId: state.pathParameters['id']!),
    ),
    // Review is reached only from the shoot screen with a fresh capture.
    GoRoute(
      path: '/review',
      redirect: (context, state) => state.extra is ReviewArgs ? null : '/',
      builder: (context, state) =>
          ReviewScreen(args: state.extra! as ReviewArgs),
    ),
  ],
);
